const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const clientMembershipSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  membershipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Membership',
    required: true
  },
  membershipType: {
    type: String,
    enum: ['value_added', 'fix_discount', 'service_discount'],
    required: true
  },
  purchaseAmount: {
    type: Number,
    required: true,
    min: 0
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled'],
    default: 'active'
  },
  purchasedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }
}, {
  timestamps: true,
  collection: 'client_memberships'
});

clientMembershipSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('ClientMembership', clientMembershipSchema);