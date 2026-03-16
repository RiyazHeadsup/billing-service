const express = require('express');
const walletOtpController = require('../controllers/walletOtpController');

const router = express.Router();

router.post('/generateWalletOtp', walletOtpController.generateWalletOtp);
router.post('/verifyWalletOtp', walletOtpController.verifyWalletOtp);
router.post('/getActiveWalletOtp', walletOtpController.getActiveOtp);

module.exports = router;
