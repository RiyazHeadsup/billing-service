const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const inventorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  qty: {
    type: Number
  },
  totalUnitQty: {
    type: Number
  },
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false
  },
  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: false
  },
  serviceIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: false
  }],
  stockIn: {
    type: Number
  },
  stockOut: {
    type: Number
  },
  status: {
    type: String,
    trim: true
  },
  inventoryBill: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'inventory'
});

inventorySchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Inventory', inventorySchema);
