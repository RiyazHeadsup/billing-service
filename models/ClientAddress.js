const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const clientAddressSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home',
    trim: true
  },
  label: {
    type: String,
    trim: true,
    default: 'Home'
  },
  flat: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  landmark: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  pincode: {
    type: String,
    trim: true
  },
  lat: {
    type: Number,
    default: null
  },
  lng: {
    type: Number,
    default: null
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'clientaddresses'
});

clientAddressSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('ClientAddress', clientAddressSchema);
