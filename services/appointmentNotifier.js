const Bill = require('../models/Bill');
const Unit = require('../models/Unit');
const { parseBillTime, zonedMidnight } = require('./slotService');
const { TIME_ZONE, localNow } = require('../utils/salonTimings');

// Push notifications to the customer for appointment events, sent through
// general-service (which owns FCM and push tokens). Never blocks or fails the
// request that triggered it.
//
// Events: booked (app), booked_by_salon, cancelled_by_client,
// cancelled_by_salon, rescheduled, completed, reminder.

const REMINDER_MINUTES = Number(process.env.APPOINTMENT_REMINDER_MINUTES) || 120;
const REMINDER_EVERY_MS = 5 * 60 * 1000;

// ── general-service address: GENERAL_SERVICE_URL, else Consul ──
let cachedUrl = null;
let cachedAt = 0;
const generalServiceUrl = async () => {
  if (process.env.GENERAL_SERVICE_URL) return process.env.GENERAL_SERVICE_URL;
  if (cachedUrl && Date.now() - cachedAt < 30000) return cachedUrl;

  const consul = `http://${process.env.CONSUL_HOST || 'localhost'}:${process.env.CONSUL_PORT || 8500}`;
  const res = await fetch(`${consul}/v1/health/service/generalservice?passing=true`, { signal: AbortSignal.timeout(5000) });
  const [entry] = await res.json();
  if (!entry) throw new Error('generalservice not found in Consul');
  cachedUrl = `http://${entry.Service.Address || entry.Node.Address}:${entry.Service.Port}`;
  cachedAt = Date.now();
  return cachedUrl;
};

// 'Thu 15 Oct, 12:00 PM'
const whenLabel = (bill) => {
  const day = localNow(new Date(bill.date)).date;
  const mins = parseBillTime(bill.slotStart);
  if (mins === null) return day;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date(zonedMidnight(day) + mins * 60000)).replace(/\b(am|pm)\b/, s => s.toUpperCase());
};

const MESSAGES = {
  booked: (salon, when) => ['Appointment confirmed', `${salon} · ${when}. Pay at the salon.`],
  booked_by_salon: (salon, when) => ['Appointment booked', `${salon} booked you in for ${when}.`],
  cancelled_by_client: (salon, when) => ['Appointment cancelled', `Your ${salon} appointment on ${when} is cancelled.`],
  cancelled_by_salon: (salon, when) => ['Appointment cancelled by salon', `${salon} cancelled your appointment on ${when}. Please contact them to rebook.`],
  rescheduled: (salon, when) => ['Appointment rescheduled', `${salon} · new time ${when}.`],
  completed: (salon) => [`Thanks for visiting ${salon}`, 'Hope you loved it. See you again soon!'],
  reminder: (salon, when) => ['Appointment reminder', `${salon} · ${when}. See you soon!`]
};

const send = async (bill, event) => {
  const clientId = bill.client?.id || bill.client?._id;
  if (!clientId || !MESSAGES[event]) return;

  const unit = await Unit.findById(bill.unitId).select('unitName').lean();
  const [title, body] = MESSAGES[event](unit?.unitName || 'Your salon', whenLabel(bill));

  const res = await fetch(`${await generalServiceUrl()}/sendAppointmentNotification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: String(clientId),
      phoneNumber: bill.client?.phoneNumber,
      title,
      body,
      type: event === 'reminder' ? 'reminder' : 'booking',
      data: { type: 'appointment', event, billId: String(bill._id), unitId: String(bill.unitId || '') }
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`general-service ${res.status}`);
};

// Fire and forget
const notifyAppointment = (bill, event) => {
  if (!bill) return;
  send(bill, event).catch(error => console.error(`[NOTIFY] ${event} for bill ${bill._id}:`, error.message));
};

// What a panel updateBill did to an appointment, for notifying the customer
const panelUpdateEvent = (before, after) => {
  if (!after || after.billType !== 'APPOINTMENT') return null;
  const cancelled = (b) => b.billStatus === 'CANCELLED' || b.status === 'cancelled';
  if (!cancelled(before) && cancelled(after)) return after.cancelledBy === 'CLIENT' ? null : 'cancelled_by_salon';
  if (before.billStatus !== 'COMPLETED' && after.billStatus === 'COMPLETED') return 'completed';
  if (!cancelled(after) && after.billStatus !== 'COMPLETED' &&
    (before.slotStart !== after.slotStart || before.slotEnd !== after.slotEnd || Number(before.date) !== Number(after.date))) {
    return 'rescheduled';
  }
  return null;
};

// ── Reminders ──
// Every few minutes, remind customers whose appointment starts within
// REMINDER_MINUTES. Each bill is claimed (reminderSentAt) before sending, so
// several billing instances never double-send. Appointments booked less than
// REMINDER_MINUTES ahead get no reminder (they just got the confirmation).
const sendDueReminders = async (now = Date.now()) => {
  const today = localNow(new Date(now)).date;
  const from = zonedMidnight(today);
  const candidates = await Bill.find({
    billType: 'APPOINTMENT',
    billStatus: { $in: ['APPOINTMENT', 'PENDING'] },
    status: { $ne: 'cancelled' },
    reminderSentAt: { $exists: false },
    slotStart: { $exists: true, $ne: '' },
    date: { $gte: from, $lt: from + 2 * 86400000 }
  }).select('date slotStart createdAt updatedAt').lean();

  let sent = 0;
  for (const c of candidates) {
    const day = localNow(new Date(c.date)).date;
    const mins = parseBillTime(c.slotStart);
    if (mins === null) continue;
    const start = zonedMidnight(day) + mins * 60000;
    const lead = start - now;
    if (lead <= 0 || lead > REMINDER_MINUTES * 60000) continue;
    const bookedAt = new Date(c.updatedAt || c.createdAt || 0).getTime();
    if (start - bookedAt < REMINDER_MINUTES * 60000) continue;

    const claimed = await Bill.findOneAndUpdate(
      { _id: c._id, reminderSentAt: { $exists: false } },
      { $set: { reminderSentAt: new Date() } },
      { new: true, timestamps: false }
    ).lean();
    if (claimed) {
      notifyAppointment(claimed, 'reminder');
      sent += 1;
    }
  }
  return sent;
};

const startReminderLoop = () => {
  if (process.env.APPOINTMENT_REMINDERS === 'off') return;
  const tick = () => sendDueReminders().catch(error => console.error('[REMINDER]', error.message));
  setInterval(tick, REMINDER_EVERY_MS).unref();
  tick();
  console.log(`⏰ Appointment reminders on (${REMINDER_MINUTES} min ahead)`);
};

module.exports = { notifyAppointment, panelUpdateEvent, sendDueReminders, startReminderLoop, whenLabel };
