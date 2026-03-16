const mongoose = require('mongoose');

const walletOtpSchema = new mongoose.Schema({
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'used', 'expired'],
    default: 'active',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  usedAt: Date,
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  }
}, {
  timestamps: true,
  collection: 'wallet_otps'
});

// Auto-expire old OTPs
walletOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('WalletOtp', walletOtpSchema);
