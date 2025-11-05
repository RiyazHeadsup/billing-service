const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const orderSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  orderNo: {
    type: Number,
    required: true,
    unique: true
  },
  invoiceNo: {
    type: String,
    required: true,
    trim: true
  },
  files: {
    type: [String],
    required: false,
    default: []
  },
  inventory: {
    type: [mongoose.Schema.Types.Mixed],
    required: true,
    default: []
  },
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false
  }
}, { 
  timestamps: true,
  collection: 'orders'
});

orderSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Order', orderSchema);