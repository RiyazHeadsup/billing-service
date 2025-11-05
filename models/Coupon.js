const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscountAmount: {
    type: Number,
    min: 0
  },
  applicableOn: {
    type: String,
    enum: ['service', 'product', 'both'],
    required: true,
    default: 'both'
  },
  specificServices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChildService'
  }],
  specificProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  minPurchaseAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxUsageLimit: {
    type: Number,
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  perUserLimit: {
    type: Number,
    min: 1
  },
  startTimestamp: {
    type: Number,
    required: true,
    default: Date.now
  },
  endTimestamp: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  unitIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  collection: 'coupons'
});

couponSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Coupon', couponSchema);