const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// Standalone payment
router.post('/initiatePayment', paymentController.initiatePayment);

// Booking payment (cart flow)
router.post('/initiateBookingPayment', paymentController.initiateBookingPayment);

// Paytm callback
router.post('/paymentCallback', paymentController.paymentCallback);

// Payment status & search
router.post('/getPaymentStatus', paymentController.getPaymentStatus);
router.post('/searchPayment', paymentController.searchPayment);
router.post('/getPaymentsByClient', paymentController.getPaymentsByClient);

// Refund
router.post('/initiateRefund', paymentController.initiateRefund);

module.exports = router;
