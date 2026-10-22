const express = require('express');
const {
  searchAppBookings,
  acceptAppBooking,
  rejectAppBooking,
  assignAppBookingStaff
} = require('../controllers/appBookingController');
const { streamAppBookingEvents } = require('../services/appBookingEvents');

// Panel App Bookings page. Staff-only: refused when x-client-id is present.
const router = express.Router();
router.post('/searchAppBookings', searchAppBookings);
router.post('/acceptAppBooking', acceptAppBooking);
router.post('/rejectAppBooking', rejectAppBooking);
router.post('/assignAppBookingStaff', assignAppBookingStaff);
router.post('/appBookingEvents', streamAppBookingEvents);
module.exports = router;
