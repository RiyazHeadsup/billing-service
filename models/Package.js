const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  services: [{  
     type: mongoose.Schema.Types.ObjectId,
      ref: 'ChildService',
      required: true}],
  totalActualPrice: {
    type: Number,
    required: true,
    min: 0
  },
  packagePrice: {
    type: Number,
    required: true,
    min: 0
  },
  discountAmount: {
    type: Number,
    min: 0
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  validity: {
    value: {
      type: Number,
      min: 1
    },
    unit: {
      type: String,
      enum: ['days', 'months', 'years']
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
  collection: 'packages'
});

packageSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Package', packageSchema);