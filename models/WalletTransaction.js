const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const walletTransactionSchema = new mongoose.Schema({
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
  transactionId: {
    type: String,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  balanceBefore: {
    type: Number,
    required: true,
    min: 0
  },
  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['bill_payment', 'membership_credit', 'refund', 'adjustment', 'bonus', 'cashback'],
    required: true,
    index: true
  },
  reference: {
    billNumber: String,
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill'
    },
    membershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership'
    },
    membershipName: String,
    couponCode: String,
    refundId: String
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed', 'cancelled'],
    default: 'completed',
    index: true
  },
  metadata: {
    paymentMethod: String,
    deviceInfo: String,
    ipAddress: String,
    userAgent: String,
    source: String
  },
  createdBy: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  notes: String
}, {
  timestamps: true,
  collection: 'wallet_transactions'
});

const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  seq: {
    type: Number,
    default: 0
  }
});

const WalletTransactionCounter = mongoose.model('WalletTransactionCounter', counterSchema);

walletTransactionSchema.pre('save', async function(next) {
  if (this.isNew && !this.transactionId) {
    try {
      const counter = await WalletTransactionCounter.findOneAndUpdate(
        { name: 'walletTransactionId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      
      const timestamp = Date.now();
      this.transactionId = `WT-${timestamp}-${counter.seq}`;
      
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

walletTransactionSchema.index({ clientId: 1, createdAt: -1 });
walletTransactionSchema.index({ walletId: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, category: 1 });
walletTransactionSchema.index({ 'reference.billNumber': 1 });
walletTransactionSchema.index({ status: 1, createdAt: -1 });

walletTransactionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);