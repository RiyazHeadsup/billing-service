const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Staff = require('../models/Staff');
const Unit = require('../models/Unit');
const { parseBillTime, zonedMidnight } = require('../services/slotService');
const { localNow } = require('../utils/salonTimings');
const { notifyAppointment } = require('../services/appointmentNotifier');
const { publishAppBooking } = require('../services/appBookingEvents');

// Panel side of customer app bookings (the "App Bookings" page).
//
// App bookings are APPOINTMENT bills with source 'APP' (see
// appAppointmentController). They are auto-confirmed for the customer; the
// salon "accepts" one to acknowledge it, which stops the panel's ringing
// alert. The salon can also reassign staff or reject (cancel) it. Completing
// goes through Quick Sale, like any appointment.
//
// Staff/admin only: requests carrying the gateway's x-client-id are refused.

const UPCOMING = ['APPOINTMENT', 'PENDING'];
const TABS = ['new', 'upcoming', 'past', 'completed', 'cancelled', 'all'];

const fail = (res, status, message, code) => res.status(status).json({ success: false, statusCode: status, message, ...(code && { code }) });

const staffOnly = (req, res) => {
  if (req.headers['x-client-id']) {
    fail(res, 403, 'Not allowed');
    return false;
  }
  return true;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Salon-local YYYY-MM-DD of a bill (`date` is UTC midnight or the start instant)
const billDay = (bill) => localNow(new Date(bill.date)).date;

const isOpenFilter = { billStatus: { $in: UPCOMING }, status: { $ne: 'cancelled' } };
const isCancelledFilter = { $or: [{ billStatus: 'CANCELLED' }, { status: 'cancelled' }] };

const tabFilter = (tab, todayStart) => {
  switch (tab) {
    case 'new': return { ...isOpenFilter, date: { $gte: todayStart }, 'acceptance.at': { $exists: false } };
    case 'upcoming': return { ...isOpenFilter, date: { $gte: todayStart } };
    // Never completed or cancelled and the day has gone: a no-show
    case 'past': return { ...isOpenFilter, date: { $lt: todayStart } };
    case 'completed': return { billStatus: 'COMPLETED' };
    case 'cancelled': return isCancelledFilter;
    default: return {};
  }
};

const stateOf = (bill, today) => {
  if (bill.billStatus === 'CANCELLED' || bill.status === 'cancelled') return 'CANCELLED';
  if (bill.billStatus === 'COMPLETED') return 'COMPLETED';
  if (billDay(bill) < today) return 'PAST';
  return bill.acceptance?.at ? 'UPCOMING' : 'NEW';
};

// Body: { tab?, search?, unitId?, from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD', page?, limit?, counts?: false }
// counts: false skips the per-tab counts (the panel's alert polls without them).
const searchAppBookings = async (req, res) => {
  if (!staffOnly(req, res)) return;

  try {
    const page = Math.max(parseInt(req.body.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.body.limit, 10) || 20, 100);
    const tab = TABS.includes(req.body.tab) ? req.body.tab : 'all';
    const today = localNow().date;
    const todayStart = zonedMidnight(today);

    const base = [{ billType: 'APPOINTMENT', source: 'APP' }];
    if (mongoose.isValidObjectId(req.body.unitId)) base.push({ unitId: new mongoose.Types.ObjectId(String(req.body.unitId)) });

    const { from, to } = req.body;
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (day.test(from || '') || day.test(to || '')) {
      const range = {};
      if (day.test(from || '')) range.$gte = zonedMidnight(from);
      if (day.test(to || '')) range.$lt = zonedMidnight(to) + 24 * 3600000;
      base.push({ date: range });
    }

    const text = typeof req.body.search === 'string' ? req.body.search.trim().slice(0, 50) : '';
    if (text) {
      const rx = { $regex: escapeRegex(text), $options: 'i' };
      base.push({ $or: [{ 'client.name': rx }, { 'client.phoneNumber': rx }, { billNumber: rx }, { 'services.name': rx }] });
    }

    const filter = { $and: [...base, tabFilter(tab, todayStart)] };
    // Bookings still to come: soonest first. Everything else: latest first.
    const order = tab === 'new' || tab === 'upcoming' ? 1 : -1;

    const [bills, totalDocs, ...tabCounts] = await Promise.all([
      Bill.find(filter).sort({ date: order, slotStart: order, createdAt: order }).skip((page - 1) * limit).limit(limit).lean(),
      Bill.countDocuments(filter),
      ...(req.body.counts === false ? [] : TABS.map(t => Bill.countDocuments({ $and: [...base, tabFilter(t, todayStart)] })))
    ]);

    const staffIds = [...new Set(bills.flatMap(b => (b.services || []).map(s => s.staff && String(s.staff))).filter(Boolean))];
    const unitIds = [...new Set(bills.map(b => b.unitId && String(b.unitId)).filter(Boolean))];
    const [staff, units] = await Promise.all([
      Staff.find({ _id: { $in: staffIds } }).select('name').lean(),
      Unit.find({ _id: { $in: unitIds } }).select('unitName').lean()
    ]);
    const staffNames = new Map(staff.map(s => [String(s._id), s.name]));
    const unitNames = new Map(units.map(u => [String(u._id), u.unitName]));

    const docs = bills.map(b => ({
      ...b,
      appState: stateOf(b, today),
      bookingDay: billDay(b),
      unitName: unitNames.get(String(b.unitId)) || null,
      services: (b.services || []).map(s => ({ ...s, staffName: s.staff ? staffNames.get(String(s.staff)) || null : null }))
    }));

    res.json({
      success: true,
      statusCode: 200,
      data: {
        docs, totalDocs, page, limit,
        totalPages: Math.max(Math.ceil(totalDocs / limit), 1),
        ...(tabCounts.length && { counts: Object.fromEntries(TABS.map((t, i) => [t, tabCounts[i]])) })
      }
    });
  } catch (error) {
    console.error('[searchAppBookings]', error);
    fail(res, 500, 'Something went wrong');
  }
};

// An open, not-yet-past app booking, or an error response
const openAppBooking = async (_id, res) => {
  if (!mongoose.isValidObjectId(_id)) { fail(res, 400, 'Valid _id is required'); return null; }
  const bill = await Bill.findOne({ _id, billType: 'APPOINTMENT', source: 'APP' }).lean();
  if (!bill) { fail(res, 404, 'App booking not found'); return null; }
  const state = stateOf(bill, localNow().date);
  if (state === 'CANCELLED' || state === 'COMPLETED') {
    fail(res, 409, `This booking is already ${state.toLowerCase()}`, 'NOT_OPEN');
    return null;
  }
  return bill;
};

// Body: { _id, acceptedBy? }
const acceptAppBooking = async (req, res) => {
  if (!staffOnly(req, res)) return;

  try {
    const bill = await openAppBooking(req.body._id, res);
    if (!bill) return;
    if (bill.acceptance?.at) return fail(res, 409, 'This booking is already accepted', 'ALREADY_ACCEPTED');

    const by = mongoose.isValidObjectId(req.body.acceptedBy) ? req.body.acceptedBy : undefined;
    const updated = await Bill.findOneAndUpdate(
      { _id: bill._id, ...isOpenFilter, 'acceptance.at': { $exists: false } },
      { $set: { acceptance: { at: new Date(), ...(by && { by }) } } },
      { new: true }
    ).lean();
    if (!updated) return fail(res, 409, 'This booking changed. Refresh and try again.', 'CHANGED');

    publishAppBooking(updated);
    res.json({ success: true, statusCode: 200, message: 'Booking accepted', data: updated });
  } catch (error) {
    console.error('[acceptAppBooking]', error);
    fail(res, 500, 'Something went wrong');
  }
};

// Body: { _id, reason? }. Cancels the booking and tells the customer.
const rejectAppBooking = async (req, res) => {
  if (!staffOnly(req, res)) return;

  try {
    const bill = await openAppBooking(req.body._id, res);
    if (!bill) return;

    const reason = typeof req.body.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim().slice(0, 300) : undefined;
    const updated = await Bill.findOneAndUpdate(
      { _id: bill._id, ...isOpenFilter },
      { $set: { billStatus: 'CANCELLED', status: 'cancelled', cancelledBy: 'SALON', cancelledAt: new Date(), ...(reason && { cancelReason: reason }) } },
      { new: true }
    ).lean();
    if (!updated) return fail(res, 409, 'This booking changed. Refresh and try again.', 'CHANGED');

    notifyAppointment(updated, 'cancelled_by_salon');
    publishAppBooking(updated);
    res.json({ success: true, statusCode: 200, message: 'Booking rejected', data: updated });
  } catch (error) {
    console.error('[rejectAppBooking]', error);
    fail(res, 500, 'Something went wrong');
  }
};

// Live appointments of `staffId` overlapping this bill's slot, other than the bill itself
const staffClash = async (bill, staffId) => {
  const day = billDay(bill);
  const start = parseBillTime(bill.slotStart);
  const end = parseBillTime(bill.slotEnd);
  if (start === null || end === null) return null;

  const others = await Bill.find({
    _id: { $ne: bill._id },
    billType: 'APPOINTMENT',
    status: { $ne: 'cancelled' },
    billStatus: { $ne: 'CANCELLED' },
    'services.staff': staffId,
    date: { $gte: zonedMidnight(day), $lt: zonedMidnight(day) + 24 * 3600000 },
    slotStart: { $exists: true, $ne: '' }
  }).select('billNumber slotStart slotEnd date').lean();

  return others.find(o => {
    if (billDay(o) !== day) return false;
    const os = parseBillTime(o.slotStart);
    const oe = parseBillTime(o.slotEnd);
    return os !== null && oe !== null && start < oe && end > os;
  }) || null;
};

// Body: { _id, assignments: [{ index, staffId }] } — index into bill.services
const assignAppBookingStaff = async (req, res) => {
  if (!staffOnly(req, res)) return;

  try {
    const bill = await openAppBooking(req.body._id, res);
    if (!bill) return;

    const assignments = Array.isArray(req.body.assignments) ? req.body.assignments : [];
    const services = bill.services || [];
    const changes = new Map();
    for (const a of assignments) {
      const index = Number(a?.index);
      if (!Number.isInteger(index) || index < 0 || index >= services.length) return fail(res, 400, 'Invalid service index');
      if (!mongoose.isValidObjectId(a.staffId)) return fail(res, 400, 'Pick a staff member for each service');
      if (String(services[index].staff || '') !== String(a.staffId)) changes.set(index, String(a.staffId));
    }
    if (!changes.size) return fail(res, 400, 'Nothing to change', 'NO_CHANGE');

    const newStaffIds = [...new Set(changes.values())];
    const staff = await Staff.find({ _id: { $in: newStaffIds }, unitIds: bill.unitId, isActive: { $ne: false } }).select('name').lean();
    if (staff.length !== newStaffIds.length) return fail(res, 400, 'Staff must be active and belong to this salon');
    const names = new Map(staff.map(s => [String(s._id), s.name]));

    for (const staffId of newStaffIds) {
      const clash = await staffClash(bill, staffId);
      if (clash) {
        return fail(res, 409, `${names.get(staffId)} already has ${clash.billNumber || 'an appointment'} at ${clash.slotStart}-${clash.slotEnd}`, 'STAFF_BUSY');
      }
    }

    const set = {};
    for (const [index, staffId] of changes) set[`services.${index}.staff`] = staffId;
    const updated = await Bill.findOneAndUpdate({ _id: bill._id, ...isOpenFilter }, { $set: set }, { new: true }).lean();
    if (!updated) return fail(res, 409, 'This booking changed. Refresh and try again.', 'CHANGED');

    publishAppBooking(updated);
    res.json({ success: true, statusCode: 200, message: 'Staff assigned', data: updated });
  } catch (error) {
    console.error('[assignAppBookingStaff]', error);
    fail(res, 500, 'Something went wrong');
  }
};

module.exports = { searchAppBookings, acceptAppBooking, rejectAppBooking, assignAppBookingStaff };
