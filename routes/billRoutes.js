const express = require('express');
const billController = require('../controllers/billController');

const router = express.Router();

router.post('/addBill', billController.createBill);
router.post('/searchBill', billController.searchBill);
router.post('/updateBill', billController.updateBill);
router.post('/deleteBill', billController.deleteBill);
router.post('/getBillByNumber', billController.getBillByNumber);
router.post('/getBillByTransactionId', billController.getBillByTransactionId);
router.post('/cancelBill', billController.cancelBill);
router.post('/refundBill', billController.refundBill);
router.post('/getBillsByClient', billController.getBillsByClient);
router.post('/getBillStats', billController.getBillStats);

module.exports = router;