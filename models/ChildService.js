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

const childServiceSchema = new mongoose.Schema({
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParentService',
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
  childDesc: {
    type: String,
    required: false,
    trim: true
  },
  steps: {
    type: [serviceStepSchema],
    required: false,
    default: []
  },
  incentive: {
    type: Number,
    required: true
  }
}, { 
  timestamps: true
});

childServiceSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('ChildService', childServiceSchema);