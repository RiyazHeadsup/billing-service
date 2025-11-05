const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const cashTransactionSchema = new mongoose.Schema({
  transactionType: {
    type: String,
    enum: ['in', 'out'],
    required: true
  },
  note500: {
    type: Number,
    default: 0,
    min: 0
  },
  note200: {
    type: Number,
    default: 0,
    min: 0
  },
  note100: {
    type: Number,
    default: 0,
    min: 0
  },
  note50: {
    type: Number,
    default: 0,
    min: 0
  },
  note20: {
    type: Number,
    default: 0,
    min: 0
  },
  note10: {
    type: Number,
    default: 0,
    min: 0
  },
  coin10: {
    type: Number,
    default: 0,
    min: 0
  },
  coin5: {
    type: Number,
    default: 0,
    min: 0
  },
  coin2: {
    type: Number,
    default: 0,
    min: 0
  },
  coin1: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true,
    index: true
  },
  transactionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  category: {
    type: String,
    enum: ['sale', 'expense', 'deposit', 'withdrawal', 'transfer', 'refund', 'other'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  reference: {
    type: String,
    trim: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  previousBalance: {
    type: Number,
    min: 0
  },
  newBalance: {
    type: Number,
    min: 0
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  inAccountTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'approved'
  },
  notes: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Number,
    default: () => Date.now()
  },
  updatedAt: {
    type: Number,
    default: () => Date.now()
  }
}, {
  timestamps: false,
  collection: 'cash_transactions'
});

cashTransactionSchema.index({ unitId: 1, transactionDate: -1 });
cashTransactionSchema.index({ transactionType: 1, status: 1 });
cashTransactionSchema.index({ category: 1 });

cashTransactionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

cashTransactionSchema.methods.calculateTotal = function() {
  return (
    this.note500 * 500 +
    this.note200 * 200 +
    this.note100 * 100 +
    this.note50 * 50 +
    this.note20 * 20 +
    this.note10 * 10 +
    this.coin10 * 10 +
    this.coin5 * 5 +
    this.coin2 * 2 +
    this.coin1 * 1
  );
};

cashTransactionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('CashTransaction', cashTransactionSchema);