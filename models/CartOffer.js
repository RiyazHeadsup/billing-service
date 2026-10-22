const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// Automatic cart offers for the customer app ("Add ₹300 more to unlock FREE
// Head Massage"). Set up in the panel (App Control → Cart Offers); worked out
// by services/cartOffers.js, both for the app's cart preview and, server-side,
// when an appointment is booked. No code: an offer applies by itself once its
// goal is met. At most one offer applies per booking: the one saving most.
//
// An offer belongs to one menu (service group), because its services do.

const cartOfferSchema = new mongoose.Schema({
  // Shown to customers, e.g. "FREE Head Massage", "20% OFF"
  title: { type: String, required: true, trim: true, maxlength: 60 },
  // Optional line under the title, e.g. "On hair services this week"
  description: { type: String, trim: true, maxlength: 200 },

  // Menu the offer's services come from; salons on this menu can run it
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
  // Empty = every salon on the menu
  unitIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Unit' }],

  // Goal: cart value (₹) or number of services
  trigger: {
    type: { type: String, enum: ['CART_VALUE', 'SERVICE_COUNT'], required: true },
    min: { type: Number, required: true, min: 1 }
  },
  // Only these services count toward the goal (empty = all)
  eligibleServiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],

  reward: {
    // FREE_SERVICE: serviceId at ₹0. SERVICE_DISCOUNT: off serviceId.
    // CART_DISCOUNT: off the whole cart.
    type: { type: String, enum: ['FREE_SERVICE', 'SERVICE_DISCOUNT', 'CART_DISCOUNT'], required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    discountType: { type: String, enum: ['percentage', 'fixed'] },
    value: { type: Number, min: 0 },
    // Cap for percentage discounts (₹)
    maxDiscount: { type: Number, min: 0 }
  },

  // Services the app suggests to close the gap (empty = picked automatically)
  suggestedServiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],

  startAt: Date,
  endAt: Date,
  firstVisitOnly: { type: Boolean, default: false },
  // Bookings per customer (0 = no limit); cancelled bookings don't count
  perClientLimit: { type: Number, default: 0, min: 0 },
  // Bookings in total (0 = no limit)
  totalLimit: { type: Number, default: 0, min: 0 },
  // Higher wins a tie and is shown first
  priority: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  collection: 'cartoffers'
});

cartOfferSchema.index({ groupId: 1, isActive: 1 });
cartOfferSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('CartOffer', cartOfferSchema);
