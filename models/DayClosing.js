const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const dayClosingSchema = new mongoose.Schema({
  date: { type: String, required: true },
  dateTimestamp: { type: Number, required: true, index: true },
  unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true, index: true },

  // Cash
  cash: {
    systemAmount: { type: Number, default: 0 },
    actualAmount: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    openingBalance: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 },
    cashIn: { type: Number, default: 0 },
    cashOut: { type: Number, default: 0 },
    changeReturned: { type: Number, default: 0 },
  },

  // Card
  card: {
    systemAmount: { type: Number, default: 0 },
    actualAmount: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
  },

  // UPI
  upi: {
    systemAmount: { type: Number, default: 0 },
    actualAmount: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
  },

  // Wallet
  wallet: {
    systemAmount: { type: Number, default: 0 },
    actualAmount: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
  },

  // Totals
  totalSystemAmount: { type: Number, default: 0 },
  totalActualAmount: { type: Number, default: 0 },
  totalDifference: { type: Number, default: 0 },

  // Sales summary
  sales: {
    totalBills: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    serviceRevenue: { type: Number, default: 0 },
    productRevenue: { type: Number, default: 0 },
    membershipRevenue: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
  },

  // Expenses
  expenses: {
    totalExpenses: { type: Number, default: 0 },
    items: [{
      category: { type: String },
      description: { type: String },
      amount: { type: Number, default: 0 },
    }],
  },

  // Net
  netAmount: { type: Number, default: 0 },

  // Meta
  closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  closedByName: { type: String },
  remarks: { type: String, trim: true },
  status: { type: String, enum: ['open', 'closed', 'reviewed'], default: 'closed' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'dayclosings'
});

dayClosingSchema.index({ dateTimestamp: 1, unitId: 1 }, { unique: true });
dayClosingSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('DayClosing', dayClosingSchema);
