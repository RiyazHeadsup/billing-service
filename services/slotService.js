const mongoose = require('mongoose');
const Unit = require('../models/Unit');
const Staff = require('../models/Staff');
const Service = require('../models/Service');
const Bill = require('../models/Bill');
const { TIME_ZONE, localNow, weekTimings, isHoliday, toMinutes } = require('../utils/salonTimings');

// Free appointment slots for a salon on a day.
//
// A slot is available when at least one eligible staff member is working for
// the whole duration and has no overlapping APPOINTMENT bill. Used by
// GET-style /getAvailableSlots and, at booking time, to re-check the chosen
// slot (Phase 1.2 createAppointment).
//
// Data notes (see CLIENT_APP_MIGRATION_README.md, Phase 1.3):
// - Staff.workingWindows is not filled in yet; staff without a window for the
//   day work the salon's hours. Staff.weekOff holds day names ('Monday').
// - There is no staff↔service mapping; any active staff of the unit can take
//   any service, as in the panel.
// - Appointment bills store slotStart/slotEnd as 'HH:mm' or 'hh:mm AM/PM', and
//   `date` either as UTC midnight of the day (current panel) or the exact start
//   instant (older bills). A salon-local day window catches both.
// - Website/app Booking docs are not staff-assigned, so they don't block staff.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_SERVICE_MINUTES = 30;
const MIN_LEAD_MINUTES = 30;      // earliest bookable slot today = now + this
const MAX_ADVANCE_DAYS = 30;

class SlotError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// '30' | '30 min' | '1 hr' | '1h 30m' | '01:00' → minutes; '' → null
const parseDuration = (value) => {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const hhmm = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (hhmm) return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  const h = /(\d+(?:\.\d+)?)\s*h/.exec(s);
  const m = /(\d+)\s*m/.exec(s);
  if (h || m) return Math.round((h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
  return null;
};

// 'HH:mm' or 'hh:mm AM/PM' → minutes since midnight (same rules as billController)
const parseBillTime = (timeStr) => {
  if (!timeStr) return null;
  let str = String(timeStr).toLowerCase().trim();
  const isPM = str.includes('pm');
  const isAM = str.includes('am');
  str = str.replace(/am|pm/g, '').trim();
  const [hRaw, mRaw = '0'] = str.split(':');
  let hours = parseInt(hRaw, 10);
  const minutes = parseInt(mRaw, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (isPM && hours !== 12) hours += 12;
  else if (isAM && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const to12h = (mins) => {
  const h = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
};

// UTC instant of 00:00 on `date` (YYYY-MM-DD) in the salon's time zone
const zonedMidnight = (date) => {
  const [y, mo, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return guess - (asLocal - guess);
};

const addDays = (date, n) => {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

const overlaps = (a, b) => a.start < b.end && a.end > b.start;

// Staff's working intervals for a weekday: their workingWindows entry for the
// day, else the salon's hours.
const staffWindows = (staff, dayName, salonOpen, salonClose) => {
  const entry = (staff.workingWindows || []).find(w => w.day === dayName);
  if (!entry || !(entry.slots || []).length) return [{ start: salonOpen, end: salonClose }];
  return entry.slots
    .map(s => ({ start: Math.max(toMinutes(s.start) ?? -1, salonOpen), end: Math.min(toMinutes(s.end) ?? -1, salonClose) }))
    .filter(w => w.start >= 0 && w.end > w.start);
};

/**
 * @param {object} p
 * @param {string} p.unitId
 * @param {string} p.date        YYYY-MM-DD, salon-local
 * @param {string[]} p.serviceIds
 * @param {string} [p.staffId]   only consider this staff member
 * @param {string} [p.excludeBillId] ignore this bill's own booking (reschedule)
 * @param {Date}   [p.now]
 */
const getAvailability = async ({ unitId, date, serviceIds, staffId, excludeBillId, now = new Date() }) => {
  if (!mongoose.isValidObjectId(unitId)) throw new SlotError(400, 'Valid unitId is required');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new SlotError(400, 'date must be YYYY-MM-DD');
  }
  const ids = Array.isArray(serviceIds) ? [...new Set(serviceIds.map(String))] : [];
  if (!ids.length || ids.length > 20 || !ids.every(id => mongoose.isValidObjectId(id))) {
    throw new SlotError(400, 'serviceIds must be a non-empty list of service ids');
  }
  if (staffId && !mongoose.isValidObjectId(staffId)) throw new SlotError(400, 'Invalid staffId');

  const unit = await Unit.findOne({ _id: unitId, status: 'Active' }).lean();
  if (!unit) throw new SlotError(404, 'Salon not found');

  const slotInterval = unit.slotInterval || 30;
  const base = { unitId: String(unit._id), date, timezone: TIME_ZONE, slotInterval };
  const closed = (reason) => ({ ...base, open: null, close: null, durationMins: null, staff: [], slots: [], reason });

  if (!unit.onlineBookingEnabled) return closed('ONLINE_BOOKING_DISABLED');

  const today = localNow(now);
  if (date < today.date) throw new SlotError(400, 'date is in the past');
  if (date > addDays(today.date, MAX_ADVANCE_DAYS)) throw new SlotError(400, `date must be within ${MAX_ADVANCE_DAYS} days`);

  // Services must be active and on this salon's menu
  const groupId = unit.appServiceGroupId || unit.serviceGroupId;
  const services = await Service.find({ _id: { $in: ids }, isActive: { $ne: false } }).select('name service_time groupId').lean();
  const onMenu = services.filter(s => groupId && String(s.groupId) === String(groupId));
  if (onMenu.length !== ids.length) throw new SlotError(400, 'One or more services are not available at this salon');
  const durationMins = onMenu.reduce((sum, s) => sum + (parseDuration(s.service_time) || DEFAULT_SERVICE_MINUTES), 0);

  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const dayName = DAY_NAMES[dayOfWeek];
  const timing = weekTimings(unit)[dayOfWeek];
  if (timing.closed || isHoliday(unit, date)) return closed('CLOSED');
  const open = toMinutes(timing.open);
  const close = toMinutes(timing.close);
  if (open === null || close === null || close <= open) return closed('CLOSED');

  // Eligible staff
  const staffQuery = { unitIds: unit._id, isActive: { $ne: false }, isPartnerBlocked: { $ne: true } };
  if (staffId) staffQuery._id = staffId;
  const staffList = (await Staff.find(staffQuery).select('name gender designation img weekOff workingWindows').lean())
    .filter(s => !(s.weekOff || []).includes(dayName));
  if (staffId && !staffList.length) throw new SlotError(400, 'Selected staff is not available on this day', 'STAFF_UNAVAILABLE');

  // Their appointments that day
  const dayStart = zonedMidnight(date);
  const dayEnd = zonedMidnight(addDays(date, 1));
  const busy = new Map(staffList.map(s => [String(s._id), []]));
  if (staffList.length) {
    const bills = await Bill.find({
      billType: 'APPOINTMENT',
      status: { $ne: 'cancelled' },
      billStatus: { $ne: 'CANCELLED' },
      'services.staff': { $in: staffList.map(s => s._id) },
      date: { $gte: dayStart, $lt: dayEnd },
      slotStart: { $exists: true, $ne: '' },
      ...(excludeBillId && mongoose.isValidObjectId(excludeBillId) && { _id: { $ne: excludeBillId } })
    }).select('slotStart slotEnd services.staff').lean();

    for (const bill of bills) {
      const start = parseBillTime(bill.slotStart);
      const end = parseBillTime(bill.slotEnd);
      if (start === null || end === null || end <= start) continue;
      for (const svc of bill.services || []) {
        const list = busy.get(String(svc.staff));
        if (list) list.push({ start, end });
      }
    }
  }

  const windows = new Map(staffList.map(s => [String(s._id), staffWindows(s, dayName, open, close)]));
  const earliest = date === today.date ? today.minutes + MIN_LEAD_MINUTES : -1;

  const slots = [];
  for (let start = open; start + durationMins <= close; start += slotInterval) {
    if (start < earliest) continue;
    const slot = { start, end: start + durationMins };
    const free = staffList
      .filter(s => {
        const id = String(s._id);
        return windows.get(id).some(w => w.start <= slot.start && w.end >= slot.end)
          && !busy.get(id).some(b => overlaps(b, slot));
      })
      .map(s => String(s._id));

    slots.push({
      start: toHHMM(slot.start),
      end: toHHMM(slot.end),
      label: `${to12h(slot.start)} - ${to12h(slot.end)}`,
      available: free.length > 0,
      staffIds: free
    });
  }

  return {
    ...base,
    open: timing.open,
    close: timing.close,
    durationMins,
    staff: staffList.map(s => ({ id: String(s._id), name: s.name, gender: s.gender || null, designation: s.designation || null, img: s.img || null })),
    slots,
    reason: !staffList.length ? 'NO_STAFF' : slots.some(s => s.available) ? null : 'FULLY_BOOKED'
  };
};

module.exports = { getAvailability, SlotError, parseDuration, parseBillTime, zonedMidnight };
