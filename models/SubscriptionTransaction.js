const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const subscriptionTransactionSchema = new mongoose.Schema({
  clientSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientSubscription',
    required: true,
    index: true
  },
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

  // What was redeemed
  type: {
    type: String,
    enum: ['service', 'complementary'],
    required: true
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  serviceName: {
    type: String,
    trim: true
  },

  // Linked bill/booking
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },

  // Value
  servicePrice: {
    type: Number,
    default: 0
  },
  discountApplied: {
    type: Number,
    default: 0
  },
  freeQty: {
    type: Number,
    default: 1
  },

  // Where redeemed
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  },

  // Who served
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  staffName: {
    type: String,
    trim: true
  },

  // Status
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'reversed'],
    default: 'completed'
  },

  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'subscription_transactions'
});

subscriptionTransactionSchema.index({ clientSubscriptionId: 1, createdAt: -1 });
subscriptionTransactionSchema.index({ clientId: 1, createdAt: -1 });
subscriptionTransactionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('SubscriptionTransaction', subscriptionTransactionSchema);
