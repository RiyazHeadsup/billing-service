const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const membershipSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  membershipType: {
    type: String,
    enum: ['value_added', 'fix_discount', 'service_discount'],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  // For value_added type
  valueAddedAmount: {
    type: Number,
    min: 0
  },
  // For fix_discount type
  fixDiscountPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  // For service_discount type
  serviceDiscounts: [{
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service'
    },
    serviceName: { 
      type: String
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    discountValue: {
      type: Number,
      min: 0
    }
  }],
  // Excluded services (applies to value_added and fix_discount types)
  excludedServices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  duration: {
    value: {
      type: Number,
      min: 1
    },
    unit: {
      type: String,
      enum: ['days', 'months', 'years'],
      default: 'months'
    }
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
  }
}, {
  timestamps: true,
  collection: 'memberships'
});

membershipSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Membership', membershipSchema);