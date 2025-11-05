const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const walletSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    unique: true,
    index: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalCredits: {
    type: Number,
    default: 0,
    min: 0
  },
  totalDebits: {
    type: Number,
    default: 0,
    min: 0
  },
  lastTransactionAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFrozen: {
    type: Boolean,
    default: false
  },
  freezeReason: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String
}, {
  timestamps: true,
  collection: 'wallets'
});

walletSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Wallet', walletSchema);