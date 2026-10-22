const { EventEmitter } = require('events');

// Live "something changed" signals for app bookings, streamed to the panel
// over Server-Sent Events so the new-booking alert rings at once instead of on
// the next poll.
//
// In-process only: production runs a single billing container. The panel
// keeps its 30s poll as a fallback, so a missed signal (restart, second
// instance) only delays the alert, it never loses a booking.

const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open panel tab

const HEARTBEAT_MS = 25000; // under the usual 60s proxy idle timeout

// type: created | changed
const publishAppBooking = (bill, type = 'changed') => {
  if (!bill || bill.source !== 'APP') return;
  bus.emit('event', { type, billId: String(bill._id), unitId: bill.unitId ? String(bill.unitId) : null });
};

// POST /appBookingEvents { unitId? } → text/event-stream. Staff only.
const streamAppBookingEvents = (req, res) => {
  if (req.headers['x-client-id']) {
    return res.status(403).json({ success: false, statusCode: 403, message: 'Not allowed' });
  }
  const unitId = req.body?.unitId ? String(req.body.unitId) : null;

  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no' // nginx: don't buffer the stream
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');

  const onEvent = (event) => {
    if (unitId && event.unitId && event.unitId !== unitId) return;
    res.write(`event: appBooking\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  bus.on('event', onEvent);
  // res, not req: req 'close' fires once the POST body is read
  res.on('close', () => {
    clearInterval(heartbeat);
    bus.off('event', onEvent);
  });
};

module.exports = { publishAppBooking, streamAppBookingEvents };
