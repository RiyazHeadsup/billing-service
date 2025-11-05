const express = require('express');
const cashBalanceController = require('../controllers/cashBalanceController');

const router = express.Router();

router.post('/addCashBalance', cashBalanceController.createCashBalance);
router.post('/searchCashBalance', cashBalanceController.searchCashBalance);
router.post('/updateCashBalance', cashBalanceController.updateCashBalance);
router.post('/deleteCashBalance', cashBalanceController.deleteCashBalance);

module.exports = router;