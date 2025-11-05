const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const incentiveSchema = new mongoose.Schema({
  // Bill reference data
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: true,
    index: true
  },
  billNumber: {
    type: String,
    required: true,
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    index: true
  },
  
  // Service reference data
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChildService',
    required: true,
    index: true
  },
  serviceName: {
    type: String,
    required: true
  },
  
  // People references
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  clientName: {
    type: String,
    required: true
  },
  
  // Financial data
  finalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  incentivePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  incentiveAmount: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  
  // Staff performance data
  servicesPerformed: {
    type: Number,
    required: true,
    min: 0
  },
  serviceCount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Target achievement data
  staffDailyTarget: {
    type: Number,
    required: true,
    min: 0
  },
  staffTotalSales: {
    type: Number,
    required: true,
    min: 0
  },
  targetAchieved: {
    type: Boolean,
    required: true,
    default: false
  },
  targetPercentage: {
    type: Number,
    default: 0
  },
  
  // Incentive program reference
  incentiveProgramId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IncentiveProgram',
    required: true
  },
  dailyIncentiveProgram: {
    type: {
      type: String,
      default: "multiple"
    },
    of: {
      type: String,
      default: "salary"
    },
    targetValue: {
      type: Number,
      default: 0,
      min: 0
    },
    maxIncentive: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: Boolean,
      default: false
    }
  },
  
  // Incentive calculation results
  incentiveAwarded: {
    type: Boolean,
    required: true,
    default: false
  },
  finalIncentiveAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  
  // Status and workflow
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'salary_adjustment', 'other']
  },
  paymentReference: {
    type: String
  },
  
  // Location and date
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true,
    index: true
  },
  businessDate: {
    type: Date,
    required: true,
    index: true
  },
  
  // Audit fields
  notes: {
    type: String,
    trim: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  calculatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Number,
    default: Date.now
  },
  updatedAt: {
    type: Number,
    default: Date.now
  }
}, {
  collection: 'incentives'
});

incentiveSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better query performance
incentiveSchema.index({ staffId: 1, businessDate: -1 });
incentiveSchema.index({ billId: 1, serviceId: 1 });
incentiveSchema.index({ status: 1, businessDate: -1 });
incentiveSchema.index({ unitId: 1, businessDate: -1 });
incentiveSchema.index({ createdAt: -1 });
incentiveSchema.index({ transactionId: 1 });
incentiveSchema.index({ targetAchieved: 1, businessDate: -1 });
incentiveSchema.index({ incentiveAwarded: 1, businessDate: -1 });

incentiveSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Incentive', incentiveSchema);