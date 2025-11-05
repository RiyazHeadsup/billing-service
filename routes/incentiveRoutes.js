const express = require('express');
const incentiveController = require('../controllers/incentiveController');

const router = express.Router();

router.post('/addIncentive', incentiveController.createIncentive);
router.post('/searchIncentive', incentiveController.searchIncentive);
router.post('/updateIncentive', incentiveController.updateIncentive);
router.post('/deleteIncentive', incentiveController.deleteIncentive);
router.post('/getIncentiveById', incentiveController.getIncentiveById);
router.post('/getIncentivesByStaff', incentiveController.getIncentivesByStaff);
router.post('/approveIncentive', incentiveController.approveIncentive);
router.post('/markIncentivePaid', incentiveController.markIncentivePaid);
router.post('/getIncentiveStats', incentiveController.getIncentiveStats);
router.post('/calculateDailyIncentive', incentiveController.calculateDailyIncentive);

module.exports = router;