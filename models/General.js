const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const generalSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true
  },
  value: {
    type: String,
    required: true,
    trim: true
  },
  usedBy: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  collection: 'generals'
});

generalSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('General', generalSchema);