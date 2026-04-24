const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// Track usage per service rule
const serviceUsageSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory'
  },
  maxAllowed: {
    type: Number,
    default: -1 // -1 = unlimited
  },
  used: {
    type: Number,
    default: 0
  }
}, { _id: false });

// Track complementary service usage
const complementaryUsageSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  maxUsage: {
    type: Number,
    default: -1
  },
  used: {
    type: Number,
    default: 0
  }
}, { _id: false });

const clientSubscriptionSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true
  },

  // Snapshot of plan at time of purchase
  planName: {
    type: String,
    required: true
  },
  planPrice: {
    type: Number,
    required: true
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  totalPaid: {
    type: Number,
    required: true
  },

  // Duration
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },

  // Service usage tracking
  totalServicesAllowed: {
    type: Number,
    default: -1 // -1 = unlimited
  },
  totalServicesUsed: {
    type: Number,
    default: 0
  },
  serviceUsage: {
    type: [serviceUsageSchema],
    default: []
  },
  complementaryUsage: {
    type: [complementaryUsageSchema],
    default: []
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'paused'],
    default: 'active',
    index: true
  },

  // Payment
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  paymentMethod: {
    type: String,
    trim: true
  },
  transactionId: {
    type: String,
    trim: true
  },

  // Unit where purchased
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  },

  // Cancellation
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    trim: true
  },

  // Renewal
  isAutoRenew: {
    type: Boolean,
    default: false
  },
  renewedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientSubscription'
  }
}, {
  timestamps: true,
  collection: 'client_subscriptions'
});

clientSubscriptionSchema.index({ clientId: 1, status: 1 });
clientSubscriptionSchema.index({ endDate: 1, status: 1 });
clientSubscriptionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('ClientSubscription', clientSubscriptionSchema);
