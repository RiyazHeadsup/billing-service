const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const accountSchema = new mongoose.Schema({
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  accountType: {
    type: String,
    enum: ['income', 'expense', 'asset', 'liability'],
    index: true
  },
  category: {
    type: String,
},
  balance: {
    type: Number,
    default: 0
  },
  totalIn: {
    type: Number,
    default: 0
  },
  totalOut: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    index: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  collection: 'accounts'
});

accountSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

accountSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Account', accountSchema);