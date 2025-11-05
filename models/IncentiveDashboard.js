const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const incentiveDashboardSchema = new mongoose.Schema({
  // Date and unit information
  businessDate: {
    type: Number,
    required: true,
    index: true
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true,
    index: true
  },
  
  // Bills reference data - lightweight summary only
  bills: [{
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      required: true,
      index: true
    },
    billNumber: {
      type: String,
      required: true
    },
    transactionId: {
      type: String,
      required: true
    },
    timestamp: {
      type: Number,
      required: true
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    serviceCount: {
      type: Number,
      required: true,
      min: 0
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      index: true
    },
    status: {
      type: String,
      enum: ['completed', 'cancelled', 'refunded', 'pending'],
      default: 'completed',
      index: true
    }
  }],
  
  // Incentive program configuration
  incentiveProgram: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IncentiveProgram',
      required: true
    },
    dailyTragetIncentive: {
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
    productIncentive: {
      tragetvalue: {
        type: Number,
        default: 0,
        min: 0
      },
      type: {
        type: String,
        default: "multiple"
      },
      of: {
        type: String,
        default: "sale"
      },
      status: {
        type: Boolean,
        default: false
      }
    },
    monthlyIncentive: {
      value: {
        type: Number,
        default: 0,
        min: 0
      },
      type: {
        type: String,
        default: "multiple"
      },
      of: {
        type: String,
        default: "salary"
      },
      afterTargetPercentage: {
        type: Number,
        default: 0,
        min: 0
      },
      status: {
        type: Boolean,
        default: false
      }
    },
    status: {
      type: String,
      default: "inactive"
    }
  },
  
  // Daily incentive program extracted
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
  
  // Staff performance summary - references to detailed records
  staffMembers: [{
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    staffName: {
      type: String,
      required: true
    },
    salary: {
      type: Number,
      required: true
    },
    
    // Calculated performance metrics (summary only)
    dailySalary: {
      type: Number,
      required: true
    },
    dailyTarget: {
      type: Number,
      required: true
    },
    totalServiceValue: {
      type: Number,
      required: true,
      min: 0
    },
    totalIncentiveAmount: {
      type: Number,
      required: true,
      min: 0
    },
    serviceCount: {
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
    incentiveEligible: {
      type: Boolean,
      required: true,
      default: false
    },
    
    // Note: All incentive details are stored in this dashboard document
    // No separate incentive records are created
  }],
  
  // Note: Individual incentive records are not created
  // All incentive data is consolidated in this dashboard
  
  // Summary statistics
  summary: {
    totalBills: {
      type: Number,
      required: true,
      min: 0
    },
    totalRevenue: {
      type: Number,
      required: true,
      min: 0
    },
    uniqueStaff: {
      type: Number,
      required: true,
      min: 0
    },
    totalServices: {
      type: Number,
      required: true,
      min: 0
    },
    totalIncentiveGiven: {
      type: Number,
      required: true,
      min: 0
    },
    staffWithTargetAchieved: {
      type: Number,
      required: true,
      min: 0
    },
    staffWithoutTargetAchieved: {
      type: Number,
      required: true,
      min: 0
    }
  },
  
  // Audit fields
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
  calculatedAt: {
    type: Number,
    default: Date.now
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['draft', 'calculated', 'approved', 'finalized'],
    default: 'calculated',
    index: true
  },
  
  // Additional metadata
  notes: {
    type: String,
    trim: true
  },
  processingTime: {
    type: Number, // milliseconds
    min: 0
  }
}, {
  timestamps: true,
  collection: 'incentiveDashboards'
});

// Pre-save middleware
incentiveDashboardSchema.pre('save', function(next) {
  if (this.isNew) {
    this.calculatedAt = Date.now();
  }
  next();
});

// Indexes for better query performance
incentiveDashboardSchema.index({ businessDate: -1, unitId: 1 });
incentiveDashboardSchema.index({ status: 1, businessDate: -1 });
incentiveDashboardSchema.index({ createdBy: 1, businessDate: -1 });
incentiveDashboardSchema.index({ calculatedBy: 1, businessDate: -1 });
incentiveDashboardSchema.index({ 'staffMembers.staffId': 1, businessDate: -1 });
incentiveDashboardSchema.index({ 'bills.billId': 1 });
incentiveDashboardSchema.index({ 'bills.clientId': 1 });
incentiveDashboardSchema.index({ 'summary.totalIncentiveGiven': -1 });

// Compound indexes for dashboard queries
incentiveDashboardSchema.index({ unitId: 1, businessDate: -1, status: 1 });
incentiveDashboardSchema.index({ businessDate: -1, 'summary.staffWithTargetAchieved': -1 });

incentiveDashboardSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('IncentiveDashboard', incentiveDashboardSchema);