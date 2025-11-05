const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const cashBalanceSchema = new mongoose.Schema({
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
  balanceType: {
    type: String,
    required: true
  },
  balanceDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  recordedBy: {
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
    default: () => Date.now()
  },
  updatedAt: {
    type: Number,
    default: () => Date.now()
  }
}, {
  timestamps: false,
  collection: 'cash_balances'
});

cashBalanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

cashBalanceSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('CashBalance', cashBalanceSchema);