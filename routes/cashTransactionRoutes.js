const express = require('express');
const cashTransactionController = require('../controllers/cashTransactionController');

const router = express.Router();

router.post('/addCashTransaction', cashTransactionController.createCashTransaction);
router.post('/searchCashTransaction', cashTransactionController.searchCashTransaction);
router.post('/updateCashTransaction', cashTransactionController.updateCashTransaction);
router.post('/deleteCashTransaction', cashTransactionController.deleteCashTransaction);

module.exports = router;