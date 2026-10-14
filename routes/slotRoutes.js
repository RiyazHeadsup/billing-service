const express = require('express');
const { getAvailableSlots } = require('../controllers/slotController');
const router = express.Router();
router.post('/getAvailableSlots', getAvailableSlots);
module.exports = router;
