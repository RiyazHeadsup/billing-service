const express = require('express');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

// Cart management
router.post('/addToCart', bookingController.addToCart);
router.post('/getCart', bookingController.getCart);
router.post('/updateCart', bookingController.updateCart);
router.post('/removeFromCart', bookingController.removeFromCart);
router.post('/clearCart', bookingController.clearCart);
router.post('/bookFromCart', bookingController.bookFromCart);

// Booking CRUD
router.post('/addBooking', bookingController.createBooking);
router.post('/searchBooking', bookingController.searchBooking);
router.post('/updateBooking', bookingController.updateBooking);
router.post('/deleteBooking', bookingController.deleteBooking);
router.post('/getBookingByNumber', bookingController.getBookingByNumber);
router.post('/getBookingsByClient', bookingController.getBookingsByClient);

// Booking actions
router.post('/cancelBooking', bookingController.cancelBooking);
router.post('/rescheduleBooking', bookingController.rescheduleBooking);
router.post('/completeBooking', bookingController.completeBooking);

module.exports = router;
