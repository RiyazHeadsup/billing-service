const express = require('express');
const walletController = require('../controllers/walletController');

const router = express.Router();

router.get('/health', walletController.getHealth);
router.post('/addWallet', walletController.createWallet);
router.post('/searchWallet', walletController.searchWallet);
router.post('/updateWallet', walletController.updateWallet);
router.post('/deleteWallet', walletController.deleteWallet);

module.exports = router;