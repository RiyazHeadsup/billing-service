const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// Standalone payment
router.post('/initiatePayment', paymentController.initiatePayment);

// Booking payment (cart flow)
router.post('/initiateBookingPayment', paymentController.initiateBookingPayment);

// Subscription payment
router.post('/initiateSubscriptionPayment', paymentController.initiateSubscriptionPayment);

// Paytm callback
router.post('/paymentCallback', paymentController.paymentCallback);

// Payment status & search
router.post('/getPaymentStatus', paymentController.getPaymentStatus);
router.post('/searchPayment', paymentController.searchPayment);
router.post('/getPaymentsByClient', paymentController.getPaymentsByClient);

// Refund
router.post('/initiateRefund', paymentController.initiateRefund);

// Cashfree (status is decided by getPaymentStatus/syncWithGateway for both gateways)
router.post('/initiateCashfreePayment', paymentController.initiateCashfreePayment);
router.post('/getCashfreeOrderStatus', paymentController.getPaymentStatus);
router.post('/cashfreeWebhook', paymentController.cashfreeWebhook);

module.exports = router;
