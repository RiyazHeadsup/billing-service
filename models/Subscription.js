const mongoose = require('mongoose');

// Subscription plans are managed by the gateway (api-gateway-consul/models/
// Subscription.js) in the same database. Billing only reads them, to price a
// customer's subscription purchase from the plan instead of the request.
const subscriptionSchema = new mongoose.Schema({
  name: String,
  price: Number,
  taxPercentage: { type: Number, default: 18 },
  taxInclusive: { type: Boolean, default: true },
  durationInDays: { type: Number, default: 30 },
  totalServicesAllowed: { type: Number, default: -1 },
  serviceRules: [{
    _id: false,
    serviceId: mongoose.Schema.Types.ObjectId,
    categoryId: mongoose.Schema.Types.ObjectId,
    subCategoryId: mongoose.Schema.Types.ObjectId,
    maxAllowed: { type: Number, default: -1 }
  }],
  complementaryServices: [{
    serviceId: mongoose.Schema.Types.ObjectId,
    maxUsage: { type: Number, default: -1 }
  }],
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  collection: 'subscriptions'
});

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
