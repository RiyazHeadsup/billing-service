const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const unitSchema = new mongoose.Schema({
  unitName: {
    type: String,
    required: true,
    trim: true
  },
  unitCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    required: true,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  rent: {
    type: Number,
    required: true
  },
  electricity: {
    type: Number,
    required: true
  },
  priceAreInclusive: {
    type: Boolean,
    default: true
  },
  gstPercentage: {
    type: Number,
    default: 18
  },
  serviceGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false
  }
}, { timestamps: true });

unitSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Unit', unitSchema);