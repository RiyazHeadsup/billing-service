const express = require('express');
const dailyDashboardController = require('../controllers/dailyDashboardController');

const router = express.Router();

router.post('/addDashboard', dailyDashboardController.createDashboard);
router.post('/searchDashboard', dailyDashboardController.searchDashboard);
router.post('/updateDashboard', dailyDashboardController.updateDashboard);
router.post('/deleteDashboard', dailyDashboardController.deleteDashboard);

module.exports = router;