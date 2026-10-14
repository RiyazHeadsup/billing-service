const express = require('express');
const {
  createAppointment,
  myAppointments,
  cancelAppointment,
  rescheduleAppointment
} = require('../controllers/appAppointmentController');

// Customer app appointments. Customer-only: need the gateway's x-client-id.
const router = express.Router();
router.post('/app/createAppointment', createAppointment);
router.post('/app/myAppointments', myAppointments);
router.post('/app/cancelAppointment', cancelAppointment);
router.post('/app/rescheduleAppointment', rescheduleAppointment);
module.exports = router;
