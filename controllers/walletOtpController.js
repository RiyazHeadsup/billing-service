const WalletOtp = require('../models/WalletOtp');
const Wallet = require('../models/Wallet');

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

class WalletOtpController {
  // Client generates OTP from app
  async generateWalletOtp(req, res) {
    try {
      const { clientId, walletId, amount } = req.body;

      if (!clientId || !walletId) {
        return res.status(400).json({ success: false, error: 'clientId and walletId are required' });
      }

      // Check wallet exists and is active
      const wallet = await Wallet.findById(walletId);
      if (!wallet) {
        return res.status(404).json({ success: false, error: 'Wallet not found' });
      }
      if (!wallet.isActive) {
        return res.status(400).json({ success: false, error: 'Wallet is inactive' });
      }
      if (wallet.isFrozen) {
        return res.status(400).json({ success: false, error: 'Wallet is frozen' });
      }

      // Validate amount if provided
      if (amount && amount > wallet.balance) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient wallet balance',
          data: { balance: wallet.balance, requested: amount }
        });
      }

      // Expire any existing active OTPs for this client
      await WalletOtp.updateMany(
        { clientId, status: 'active' },
        { status: 'expired' }
      );

      // Generate new 6-digit OTP, valid for 5 minutes
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const walletOtp = new WalletOtp({
        walletId,
        clientId,
        otp,
        amount: amount || null,
        status: 'active',
        expiresAt,
      });
      await walletOtp.save();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'OTP generated successfully',
        data: {
          otp,
          expiresAt,
          expiresInSeconds: 300,
          walletBalance: wallet.balance,
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Manager verifies OTP — permission only, no wallet deduction
  async verifyWalletOtp(req, res) {
    try {
      const { clientId, otp, amount, unitId, verifiedBy } = req.body;

      if (!clientId || !otp || !amount) {
        return res.status(400).json({ success: false, error: 'clientId, otp, and amount are required' });
      }

      // Find active OTP
      const walletOtp = await WalletOtp.findOne({
        clientId,
        otp,
        status: 'active',
        expiresAt: { $gt: new Date() }
      });

      if (!walletOtp) {
        return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
      }

      // If OTP was generated with a specific amount, validate it matches
      if (walletOtp.amount && walletOtp.amount !== amount) {
        return res.status(400).json({
          success: false,
          error: `OTP was generated for ₹${walletOtp.amount}, but ₹${amount} was requested`
        });
      }

      // Get wallet and validate balance
      const wallet = await Wallet.findById(walletOtp.walletId);
      if (!wallet) {
        return res.status(404).json({ success: false, error: 'Wallet not found' });
      }
      if (wallet.isFrozen) {
        return res.status(400).json({ success: false, error: 'Wallet is frozen' });
      }
      if (wallet.balance < amount) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient wallet balance',
          data: { balance: wallet.balance, requested: amount }
        });
      }

      // Mark OTP as used (permission granted — actual deduction happens during bill generation)
      walletOtp.status = 'used';
      walletOtp.usedAt = new Date();
      walletOtp.usedBy = verifiedBy || null;
      walletOtp.unitId = unitId || null;

      await walletOtp.save();

      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Wallet OTP verified successfully',
        data: {
          amount,
          walletBalance: wallet.balance,
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Check if client has an active OTP
  async getActiveOtp(req, res) {
    try {
      const { clientId } = req.body;
      if (!clientId) {
        return res.status(400).json({ success: false, error: 'clientId is required' });
      }

      const activeOtp = await WalletOtp.findOne({
        clientId,
        status: 'active',
        expiresAt: { $gt: new Date() }
      });

      res.status(200).json({
        success: true,
        statusCode: 200,
        data: activeOtp ? {
          hasActiveOtp: true,
          otp: activeOtp.otp,
          expiresAt: activeOtp.expiresAt,
          amount: activeOtp.amount,
        } : {
          hasActiveOtp: false,
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new WalletOtpController();
