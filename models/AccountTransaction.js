const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const accountTransactionSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    index: true
  },
  transactionType: {
    type: String,
    enum: ['debit', 'credit'],
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  referenceType: {
    type: String,
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  paymentMethod: {
    type: String,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true,
    index: true
  },
  transactionDate: {
    type: Number,
    required: true,
    default: Date.now,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Number,
    default: Date.now
  },
  updatedAt: {
    type: Number,
    default: Date.now
  }
}, {
  collection: 'account_transactions'
});

accountTransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

accountTransactionSchema.index({ accountId: 1, transactionDate: -1 });
accountTransactionSchema.index({ userId: 1, transactionDate: -1 });
accountTransactionSchema.index({ unitId: 1, transactionDate: -1 });
accountTransactionSchema.index({ transactionType: 1, transactionDate: -1 });

accountTransactionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('AccountTransaction', accountTransactionSchema);