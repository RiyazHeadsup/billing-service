const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const parentServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false,
    trim: true
  },
  img: {
    type: String,
    required: false,
    trim: true
  },
  parentDesc: {
    type: String,
    default: '',
    trim: true
  },
  unitIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  }]
}, { 
  timestamps: true
});

parentServiceSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('ParentService', parentServiceSchema);