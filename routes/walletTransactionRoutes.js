const express = require('express');
const walletTransactionController = require('../controllers/walletTransactionController');

const router = express.Router();

router.post('/createWalletTransaction', walletTransactionController.createTransaction);
router.post('/getWalletTransactions', walletTransactionController.getTransactions);
router.post('/getWalletTransactionsByWallet', walletTransactionController.getTransactionsByWallet);
router.post('/getWalletTransactionsByClient', walletTransactionController.getTransactionsByClient);
router.post('/getWalletTransactionById', walletTransactionController.getTransactionById);
router.post('/getWalletTransactionByTransactionId', walletTransactionController.getTransactionByTransactionId);
router.post('/getWalletBalance', walletTransactionController.getWalletBalance);
router.post('/getWalletTransactionStats', walletTransactionController.getTransactionStats);

module.exports = router;