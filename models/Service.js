const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const productItemSchema = new mongoose.Schema({
  product: {
    type: String,
    ref: 'Product',
    required: false
  },
  quantity: {
    type: String,
    required: false
  },
  isDeliverdProduct: {
    type: Boolean,
    required: false,
    default: false
  },
  productType: {
    type: String,
    required: false
  },
  brand: {
    type: String,
    required: false
  }
}, { _id: false });

const serviceStepSchema = new mongoose.Schema({
  id: {
    type: String,
    required: false
  },
  stepName: {
    type: String,
    required: false
  },
  products: {
    type: [productItemSchema],
    required: false,
    default: []
  },
  step: {
    type: Number,
    required: false
  },
  isDelivered: {
    type: Boolean,
    required: false,
    default: false
  },
  service_time: {
    type: String,
    required: false
  }
}, { _id: false });

const serviceVariationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  productQty: {
    type: Number,
    required: false,
    default: 1
  },
  price: {
    type: Number,
    required: false
  },
  memberPrice: {
    type: Number,
    required: false
  },
  images: [{
    type: String,
    trim: true
  }],
  duration: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const serviceSchema = new mongoose.Schema({
  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubCategory',
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false
  },
  staffIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }],
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false
  },
  name: {
    type: String,
    required: false,
    trim: true
  },
  service_time: {
    type: String,
    required: false
  },
  price: {
    type: Number,
    required: false
  },
  member_price: {
    type: Number,
    required: false
  },
  img: {
    type: String,
    required: false,
    trim: true
  },
  description: {
    type: String,
    required: false,
    trim: true
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Unisex'],
    required: false,
    default: 'Unisex'
  },
  serviceFor: {
    type: String,
    enum: ['Adult', 'Child', 'Both'],
    required: false,
    default: 'Both'
  },
  serviceType: {
    type: String,
    enum: ['Salon', 'Wellness'],
    required: false,
    default: 'Salon'
  },
  isProductRequired: {
    type: Boolean,
    required: false,
    default: false
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  inventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: false
  },
  productQty: {
    type: Number,
    default: 1,
    min: 1
  },
  reduceInventoryOnBilling: {
    type: Boolean,
    default: true
  },
  isMultiSession: {
    type: Boolean,
    default: false
  },
  numberOfSessions: {
    type: Number,
    default: 1,
    min: 1
  },
  serviceParentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: false
  },
  isTransferred: {
    type: Boolean,
    default: false
  },
  groupUsing: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  }],
  variations: {
    type: [serviceVariationSchema],
    required: false,
    default: []
  },
  steps: {
    type: [serviceStepSchema],
    required: false,
    default: []
  },
  incentive: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

serviceSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Service', serviceSchema);
