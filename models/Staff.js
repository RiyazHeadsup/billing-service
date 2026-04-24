const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const staffSchema = new mongoose.Schema({
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
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  gender: {
    type: String,
    trim: true
  },
  img: {
    type: String,
    trim: true
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  },
  unitIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  }],
  experience: {
    type: String,
    trim: true
  },
  specialisation: [{
    type: String,
    trim: true
  }],
  profilePic: {
    type: String,
    trim: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
  },
  workingWindows: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    slots: [{
      start: { type: String },
      end: { type: String }
    }]
  }],
}, {
  timestamps: true,
  collection: 'staffs'
});

staffSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Staff', staffSchema);
