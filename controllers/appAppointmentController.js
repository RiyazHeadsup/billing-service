const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const Client = require('../models/Client');
const Service = require('../models/Service');
const Staff = require('../models/Staff');
const Unit = require('../models/Unit');
const { getAvailability, SlotError, parseBillTime, zonedMidnight } = require('../services/slotService');
const { localNow } = require('../utils/salonTimings');

// Customer appointments from the app (Phase 1.2, Option A).
//
// An app booking is the same Bill the panel creates for an appointment
// (billType/billStatus APPOINTMENT), with source 'APP', so it shows on the
// panel's Appointments page and goes through "Complete & Bill" unchanged.
//
// - Auto-confirmed: the slot is checked with getAvailability at booking time.
// - Pay at salon only for now; online payment comes with the Cashfree port.
// - Staff is optional; without one the first free staff for the slot is used.
// - Prices come from the Service records, never the request.
//
// The client is the gateway's x-client-id; these routes refuse requests
// without it.

const UPCOMING = ['APPOINTMENT', 'PENDING'];
const MAX_UPCOMING_PER_CLIENT = 5;

const fail = (res, status, message, code) => res.status(status).json({ success: false, statusCode: status, message, ...(code && { code }) });

const clientIdFrom = (req, res) => {
  const cid = req.headers['x-client-id'];
  if (!cid || !mongoose.isValidObjectId(cid)) {
    fail(res, 403, 'Customer login required');
    return null;
  }
  return cid;
};

// Bills match the customer by id or phone (one person has a Client per unit)
const ownerFilter = async (cid) => {
  const client = await Client.findById(cid).select('phoneNumber').lean();
  const or = [{ 'client.id': cid }, { 'client._id': cid }];
  if (client?.phoneNumber) or.push({ 'client.phoneNumber': client.phoneNumber });
  return { $or: or };
};

const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const to12h = (mins) => `${Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${mins < 720 ? 'AM' : 'PM'}`;

// Salon-local YYYY-MM-DD of a bill. Works for both stored conventions (UTC
// midnight of the day, or the exact start instant).
const billDay = (bill) => localNow(new Date(bill.date)).date;

const startInstant = (bill) => {
  const mins = parseBillTime(bill.slotStart);
  return mins === null ? null : zonedMidnight(billDay(bill)) + mins * 60000;
};

const isUpcoming = (bill) => UPCOMING.includes(bill.billStatus) && bill.status !== 'cancelled';

const withinWindow = (bill, unit, now = Date.now()) => {
  const start = startInstant(bill);
  const windowMins = unit?.cancellationWindowMins ?? 120;
  return start !== null && start - now >= windowMins * 60000;
};

// Another live appointment for this staff overlapping [start, end) that was
// created before `bill`. On a race both sides run this; only the later one
// sees a conflict and backs out.
const lostRace = async (bill, staffId) => {
  const day = billDay(bill);
  const start = parseBillTime(bill.slotStart);
  const end = parseBillTime(bill.slotEnd);
  const others = await Bill.find({
    _id: { $ne: bill._id },
    billType: 'APPOINTMENT',
    status: { $ne: 'cancelled' },
    billStatus: { $ne: 'CANCELLED' },
    'services.staff': staffId,
    date: { $gte: zonedMidnight(day), $lt: zonedMidnight(day) + 24 * 3600000 },
    slotStart: { $exists: true, $ne: '' }
  }).select('_id slotStart slotEnd date updatedAt').lean();

  return others.some(o => {
    if (billDay(o) !== day) return false;
    const os = parseBillTime(o.slotStart);
    const oe = parseBillTime(o.slotEnd);
    if (os === null || oe === null || !(start < oe && end > os)) return false;
    // Earlier write wins: older _id for creates, older updatedAt for reschedules
    return String(o._id) < String(bill._id) || (o.updatedAt && bill.updatedAt && o.updatedAt < bill.updatedAt);
  });
};

// Pick the slot and staff for a booking, or throw SlotError
const reserve = async ({ unitId, date, slotStart, serviceIds, staffId, excludeBillId, preferStaffId }) => {
  if (typeof slotStart !== 'string' || !/^\d{2}:\d{2}$/.test(slotStart)) throw new SlotError(400, 'slotStart must be HH:mm');
  const availability = await getAvailability({ unitId, date, serviceIds, staffId, excludeBillId });
  if (availability.reason && availability.reason !== 'FULLY_BOOKED') {
    throw new SlotError(409, 'This salon is not taking bookings for that day', availability.reason);
  }
  const slot = availability.slots.find(s => s.start === slotStart);
  if (!slot || !slot.available) throw new SlotError(409, 'This slot is no longer available', 'SLOT_TAKEN');

  const chosen = staffId
    ? String(staffId)
    : (preferStaffId && slot.staffIds.includes(String(preferStaffId)) ? String(preferStaffId) : slot.staffIds[0]);
  if (!slot.staffIds.includes(chosen)) throw new SlotError(409, 'This slot is no longer available', 'SLOT_TAKEN');
  return { availability, slot, staffId: chosen };
};

const sendSlotError = (res, error, tag) => {
  if (error instanceof SlotError) return fail(res, error.status, error.message, error.code);
  console.error(`[${tag}]`, error);
  return fail(res, 500, 'Something went wrong');
};

// Body: { unitId, date: 'YYYY-MM-DD', slotStart: 'HH:mm', serviceIds: [], staffId?, paymentMode?: 'PAY_AT_SALON', remarks? }
const createAppointment = async (req, res) => {
  const cid = clientIdFrom(req, res);
  if (!cid) return;

  try {
    const { unitId, date, slotStart, serviceIds, staffId, remarks } = req.body;
    const paymentMode = req.body.paymentMode || 'PAY_AT_SALON';
    if (paymentMode !== 'PAY_AT_SALON') return fail(res, 400, 'Only pay at salon is available right now', 'PAYMENT_MODE');

    const client = await Client.findById(cid).lean();
    if (!client) return fail(res, 403, 'Customer login required');

    const owner = await ownerFilter(cid);
    const upcoming = await Bill.countDocuments({ billType: 'APPOINTMENT', billStatus: { $in: UPCOMING }, status: { $ne: 'cancelled' }, ...owner, date: { $gte: Date.now() - 86400000 } });
    if (upcoming >= MAX_UPCOMING_PER_CLIENT) return fail(res, 429, `You can have at most ${MAX_UPCOMING_PER_CLIENT} upcoming appointments`, 'TOO_MANY');

    const { slot, staffId: chosenStaff } = await reserve({ unitId, date, slotStart, serviceIds, staffId });

    const unit = await Unit.findById(unitId).lean();
    if (unit.payAtSalonAllowed === false) return fail(res, 400, 'This salon does not take pay-at-salon bookings', 'PAYMENT_MODE');

    // Server-side pricing, in the order the customer picked
    const ids = [...new Set(serviceIds.map(String))];
    const services = await Service.find({ _id: { $in: ids } }).select('name price incentive').lean();
    const byId = new Map(services.map(s => [String(s._id), s]));
    const billServices = ids.map(id => {
      const s = byId.get(id);
      const price = Number(s.price) || 0;
      return {
        id: s._id,
        name: s.name,
        quantity: 1,
        pricing: { basePrice: price, finalPrice: price, totalPrice: price, totalBasePrice: price, savings: 0 },
        discount: { discountType: 'fixed', value: 0, source: 'manual', amount: 0 },
        staff: chosenStaff,
        incentive: Number(s.incentive) || 0
      };
    });
    const total = billServices.reduce((sum, s) => sum + s.pricing.totalPrice, 0);
    const day = new Date(`${date}T00:00:00Z`);

    const bill = new Bill({
      timestamp: day,
      billDate: day.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
      billTime: slot.start,
      date: day.getTime(), // UTC midnight of the day, as the panel stores it
      slotStart: slot.start,
      slotEnd: slot.end,
      client: {
        _id: client._id, id: String(client._id), name: client.name, phoneNumber: client.phoneNumber,
        gender: client.gender, customerType: client.customerType,
        totalVisit: client.totalVisit || 0, points: client.points || 0, createdAt: client.createdAt
      },
      services: billServices,
      products: [],
      calculations: {
        items: {
          services: { count: billServices.length, baseTotal: total, finalTotal: total, totalDiscount: 0 },
          products: { count: 0, baseTotal: 0, finalTotal: 0, totalDiscount: 0 },
          memberships: { count: 0, baseTotal: 0, finalTotal: 0, totalDiscount: 0 }
        },
        totals: {
          totalItems: billServices.length, subtotalBeforeDiscount: total, subtotalAfterItemDiscount: total,
          totalItemDiscount: 0, couponDiscount: 0, grandTotal: total, totalDiscount: 0, totalSavings: 0, finalAmount: total
        }
      },
      payment: {
        methods: { cash: 0, card: 0, upi: 0, wallet: 0, app: 0 },
        activePaymentMethods: [],
        totalPaid: 0,
        paymentStatus: 'Pending',
        remainingAmount: total
      },
      remarks: typeof remarks === 'string' && remarks.trim() ? remarks.trim().slice(0, 500) : undefined,
      status: 'pending',
      billType: 'APPOINTMENT',
      billStatus: 'APPOINTMENT',
      source: 'APP',
      paymentMode,
      unitId: unit._id
    });
    await bill.save();

    if (await lostRace(bill, chosenStaff)) {
      await Bill.deleteOne({ _id: bill._id });
      return fail(res, 409, 'This slot was just taken. Please pick another.', 'SLOT_TAKEN');
    }

    res.status(201).json({ success: true, statusCode: 201, message: 'Appointment booked', data: await present(bill.toObject()) });
  } catch (error) {
    sendSlotError(res, error, 'createAppointment');
  }
};

// Shape returned to the app
const present = async (bill, units, staffNames) => {
  const unit = units ? units.get(String(bill.unitId)) : await Unit.findById(bill.unitId).select('unitName address phone cancellationWindowMins').lean();
  const staffIds = [...new Set((bill.services || []).map(s => s.staff && String(s.staff)).filter(Boolean))];
  const names = staffNames || new Map((await Staff.find({ _id: { $in: staffIds } }).select('name').lean()).map(s => [String(s._id), s.name]));
  const start = parseBillTime(bill.slotStart);
  const end = parseBillTime(bill.slotEnd);
  const upcoming = isUpcoming(bill);
  const changeable = upcoming && withinWindow(bill, unit);

  return {
    _id: bill._id,
    billNumber: bill.billNumber,
    status: bill.billStatus === 'CANCELLED' || bill.status === 'cancelled' ? 'CANCELLED'
      : bill.billStatus === 'COMPLETED' ? 'COMPLETED'
        : upcoming ? 'UPCOMING' : bill.billStatus,
    date: billDay(bill),
    slotStart: start !== null ? toHHMM(start) : bill.slotStart || null,
    slotEnd: end !== null ? toHHMM(end) : bill.slotEnd || null,
    label: start !== null && end !== null ? `${to12h(start)} - ${to12h(end)}` : null,
    salon: unit ? { unitId: unit._id, unitName: unit.unitName, address: unit.address, phone: unit.phone } : null,
    services: (bill.services || []).map(s => ({
      id: s.id,
      name: s.name,
      price: s.pricing?.totalPrice ?? null,
      staff: s.staff ? { id: String(s.staff), name: names.get(String(s.staff)) || null } : null
    })),
    total: bill.calculations?.totals?.grandTotal ?? null,
    paymentMode: bill.paymentMode || null,
    paymentStatus: bill.payment?.paymentStatus || null,
    source: bill.source || null,
    canCancel: changeable,
    canReschedule: changeable,
    cancelledBy: bill.cancelledBy || null
  };
};

// Body: { status?: 'upcoming' | 'past' | 'all', page?, limit? }
const myAppointments = async (req, res) => {
  const cid = clientIdFrom(req, res);
  if (!cid) return;

  try {
    const page = Math.max(parseInt(req.body.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.body.limit, 10) || 20, 50);
    const filter = { billType: 'APPOINTMENT', ...(await ownerFilter(cid)) };
    if (req.body.status === 'upcoming') Object.assign(filter, { billStatus: { $in: UPCOMING }, status: { $ne: 'cancelled' } });
    if (req.body.status === 'past') filter.$and = [{ $or: [{ billStatus: { $nin: UPCOMING } }, { status: 'cancelled' }] }];

    const [bills, total] = await Promise.all([
      Bill.find(filter).sort({ date: -1, slotStart: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Bill.countDocuments(filter)
    ]);

    const units = new Map((await Unit.find({ _id: { $in: [...new Set(bills.map(b => String(b.unitId)))] } })
      .select('unitName address phone cancellationWindowMins').lean()).map(u => [String(u._id), u]));
    const staffIds = [...new Set(bills.flatMap(b => (b.services || []).map(s => s.staff && String(s.staff))).filter(Boolean))];
    const names = new Map((await Staff.find({ _id: { $in: staffIds } }).select('name').lean()).map(s => [String(s._id), s.name]));

    const docs = await Promise.all(bills.map(b => present(b, units, names)));
    res.json({ success: true, statusCode: 200, data: { docs, totalDocs: total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    sendSlotError(res, error, 'myAppointments');
  }
};

// Load the customer's own upcoming appointment, checking the cancellation window
const ownUpcoming = async (cid, _id, res) => {
  if (!mongoose.isValidObjectId(_id)) { fail(res, 400, 'Valid _id is required'); return null; }
  const bill = await Bill.findOne({ _id, billType: 'APPOINTMENT', ...(await ownerFilter(cid)) }).lean();
  if (!bill) { fail(res, 404, 'Appointment not found'); return null; }
  if (!isUpcoming(bill)) { fail(res, 409, 'This appointment can no longer be changed', 'NOT_UPCOMING'); return null; }
  const unit = await Unit.findById(bill.unitId).select('cancellationWindowMins').lean();
  if (!withinWindow(bill, unit)) {
    fail(res, 409, `Appointments can only be changed up to ${unit?.cancellationWindowMins ?? 120} minutes before the start`, 'WINDOW_PASSED');
    return null;
  }
  return bill;
};

// Body: { _id, reason? }
const cancelAppointment = async (req, res) => {
  const cid = clientIdFrom(req, res);
  if (!cid) return;

  try {
    const bill = await ownUpcoming(cid, req.body._id, res);
    if (!bill) return;

    const updated = await Bill.findOneAndUpdate(
      { _id: bill._id, billStatus: { $in: UPCOMING }, status: { $ne: 'cancelled' } },
      {
        billStatus: 'CANCELLED',
        status: 'cancelled',
        cancelledBy: 'CLIENT',
        cancelReason: typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 300) : undefined,
        cancelledAt: new Date()
      },
      { new: true }
    ).lean();
    if (!updated) return fail(res, 409, 'This appointment can no longer be changed', 'NOT_UPCOMING');

    res.json({ success: true, statusCode: 200, message: 'Appointment cancelled', data: await present(updated) });
  } catch (error) {
    sendSlotError(res, error, 'cancelAppointment');
  }
};

// Body: { _id, date: 'YYYY-MM-DD', slotStart: 'HH:mm', staffId? }
const rescheduleAppointment = async (req, res) => {
  const cid = clientIdFrom(req, res);
  if (!cid) return;

  try {
    const bill = await ownUpcoming(cid, req.body._id, res);
    if (!bill) return;

    const { date, slotStart, staffId } = req.body;
    const serviceIds = (bill.services || []).map(s => String(s.id)).filter(Boolean);
    const currentStaff = (bill.services || []).map(s => s.staff).find(Boolean);

    const { slot, staffId: chosenStaff } = await reserve({
      unitId: bill.unitId, date, slotStart, serviceIds, staffId,
      excludeBillId: bill._id, preferStaffId: currentStaff
    });

    const day = new Date(`${date}T00:00:00Z`);
    const updated = await Bill.findOneAndUpdate(
      { _id: bill._id, billStatus: { $in: UPCOMING }, status: { $ne: 'cancelled' } },
      {
        $set: {
          timestamp: day,
          billDate: day.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
          billTime: slot.start,
          date: day.getTime(),
          slotStart: slot.start,
          slotEnd: slot.end,
          'services.$[].staff': chosenStaff
        }
      },
      { new: true }
    ).lean();
    if (!updated) return fail(res, 409, 'This appointment can no longer be changed', 'NOT_UPCOMING');

    if (await lostRace(updated, chosenStaff)) {
      // Put the appointment back where it was
      await Bill.updateOne({ _id: bill._id }, {
        $set: {
          timestamp: bill.timestamp, billDate: bill.billDate, billTime: bill.billTime, date: bill.date,
          slotStart: bill.slotStart, slotEnd: bill.slotEnd, services: bill.services
        }
      });
      return fail(res, 409, 'This slot was just taken. Please pick another.', 'SLOT_TAKEN');
    }

    res.json({ success: true, statusCode: 200, message: 'Appointment rescheduled', data: await present(updated) });
  } catch (error) {
    sendSlotError(res, error, 'rescheduleAppointment');
  }
};

module.exports = { createAppointment, myAppointments, cancelAppointment, rescheduleAppointment };
