const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const IncentiveProgramSchema = new mongoose.Schema({
  dailyTragetIncentive: {
   type: {
      type: String,
      default: "multiple"
    }, of: {
      type: String,
      default: "salary"
    }, targetValue: {
      type: Number,
      default: 0,
      min: 0
    },maxIncentive: {
      type: Number,
      default: 0,
      min: 0
    }, status: {
      type: Boolean,
      default: false
    }
  }, productIncentive: {
    tragetvalue: {
      type: Number,
      default: 0,
      min: 0
    }, type: {
      type: String,
      default: "multiple"
    }, of: {
      type: String,
      default: "sale"
    }, status: {
      type: Boolean,
      default: false
    }
  }, monthlyIncentive: {
     value: {
      type: Number,
      default: 0,
      min: 0
    }, type: {
      type: String,
      default: "multiple"
    }, of: {
      type: String,
      default: "salary"
    },afterTargetPercentage: {
      type: Number,
      default: 0,
      min: 0
    }, status: {
      type: Boolean,
      default: false
    }
  },
  status: {
    type: String,
    default: "inactive"
  },
  freezeReason: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  unitIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  }],
  notes: String
}, {
  timestamps: true,
  collection: 'IncentiveProgram'
});

IncentiveProgramSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('IncentiveProgram', IncentiveProgramSchema);