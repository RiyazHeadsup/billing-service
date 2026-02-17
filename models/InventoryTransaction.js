const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const inventoryTransactionSchema = new mongoose.Schema({
  inventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false
  },
  transactionType: {
    type: String,
    enum: ['IN', 'OUT', 'ADJUSTMENT'],
    required: true
  },
  qty: {
    type: Number,
    required: true
  },
  previousQty: {
    type: Number,
    required: false
  },
  newQty: {
    type: Number,
    required: false
  },
  reason: {
    type: String,
    trim: true
  },
  referenceId: {
    type: String,
    trim: true
  },
  referenceType: {
    type: String,
    enum: ['PURCHASE', 'SALE', 'RETURN', 'DAMAGE', 'MANUAL', 'TRANSFER'],
    required: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true,
  collection: 'inventorytransactions'
});

inventoryTransactionSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);
