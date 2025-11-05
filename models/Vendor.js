const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const vendorSchema = new mongoose.Schema({
  vendorName: {
    type: String,
    trim: true
  },
  gst: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  contact: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false
  },
  status: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  }
}, { 
  timestamps: true
});

vendorSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Vendor', vendorSchema);