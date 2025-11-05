const express = require('express');
const couponController = require('../controllers/couponController');
const { validateCouponCreation, validateCouponUpdate, validateCouponValidation } = require('../middleware/couponValidation');

const router = express.Router();

router.post('/addCoupon', validateCouponCreation, couponController.createCoupon);
router.post('/searchCoupon', couponController.searchCoupon);
router.post('/updateCoupon', validateCouponUpdate, couponController.updateCoupon);
router.post('/deleteCoupon', couponController.deleteCoupon);
router.post('/validateCoupon', validateCouponValidation, couponController.validateCoupon);
router.post('/applyCoupon', couponController.applyCoupon);

module.exports = router;