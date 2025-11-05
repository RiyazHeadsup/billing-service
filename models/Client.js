const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true
  },
  gender: {
    type: String,
    required: false,
    trim: true
  },
  img: {
    type: String,
    trim: true
  },
  imageGroupg: {
    type: String,
    trim: true
  },
  ageGroup: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  unpaidAmt: {
    type: Number,
    default: 0,
    min: 0
  },
  totalVisit: {
    type: Number,
    default: 0,
    min: 0
  },
  lastVisit: {
    type: Date
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: false
  },
  memberShip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'membership',
    required: false
  },
  points: {
    type: Number,
    default: 0,
    min: 0
  },
  address: {
    type: String,
    trim: true
  },
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false
  },
  customerType: {
    type: String,
    required: true,
    trim: true
  }
}, { 
  timestamps: true,
  collection: 'clients'
});

clientSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Client', clientSchema);