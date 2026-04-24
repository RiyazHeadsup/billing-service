const express = require('express');
const controller = require('../controllers/dayClosingController');

const router = express.Router();

router.post('/addDayClosing', controller.addDayClosing);
router.post('/searchDayClosing', controller.searchDayClosing);
router.post('/updateDayClosing', controller.updateDayClosing);
router.post('/deleteDayClosing', controller.deleteDayClosing);
router.post('/generateDayClosing', controller.generateDayClosing);

module.exports = router;
