const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const dailyDashboardSchema = new mongoose.Schema({
  date: {
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
  sales: {
    totalBills: {
      type: Number,
      default: 0
    },
    totalRevenue: {
      type: Number,
      default: 0
    },
    services: {
      count: {
        type: Number,
        default: 0
      },
      revenue: {
        type: Number,
        default: 0
      }
    },
    products: {
      count: {
        type: Number,
        default: 0
      },
      revenue: {
        type: Number,
        default: 0
      }
    },
    memberships: {
      count: {
        type: Number,
        default: 0
      },
      revenue: {
        type: Number,
        default: 0
      }
    }
  },
  payments: {
    cash: {
      type: Number,
      default: 0
    },
    card: {
      type: Number,
      default: 0
    },
    upi: {
      type: Number,
      default: 0
    },
    wallet: {
      type: Number,
      default: 0
    },
    totalCollected: {
      type: Number,
      default: 0
    },
    changeReturned: {
      type: Number,
      default: 0
    }
  },
  discounts: {
    totalDiscountGiven: {
      type: Number,
      default: 0
    },
    couponDiscount: {
      type: Number,
      default: 0
    },
    membershipDiscount: {
      type: Number,
      default: 0
    },
    totalCouponsUsed: {
      type: Number,
      default: 0
    }
  },
  clients: {
    totalClients: {
      type: Number,
      default: 0
    },
    newClients: {
      type: Number,
      default: 0
    },
    returningClients: {
      type: Number,
      default: 0
    }
  },
  bills: {
    completed: {
      type: Number,
      default: 0
    },
    pending: {
      type: Number,
      default: 0
    },
    cancelled: {
      type: Number,
      default: 0
    },
    refunded: {
      type: Number,
      default: 0
    }
  },
  expenses: {
    rent: {
      type: Number,
      default: 0
    },
    electricity: {
      type: Number,
      default: 0
    },
    incentives: {
      type: Number,
      default: 0
    },
    other: {
      type: Number,
      default: 0
    },
    totalExpenses: {
      type: Number,
      default: 0
    }
  },
  avgBillValue: {
    type: Number,
    default: 0
  },
  netProfit: {
    type: Number,
    default: 0
  },
  topServices: [{
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChildService'
    },
    serviceName: String,
    count: Number,
    revenue: Number
  }],
  topProducts: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    count: Number,
    revenue: Number
  }],
  staffPerformance: [{
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    staffName: String,
    totalSales: Number,
    billsHandled: Number,
    incentivesEarned: Number
  }],
  createdAt: {
    type: Number,
    default: Date.now
  },
  updatedAt: {
    type: Number,
    default: Date.now
  }
}, {
  collection: 'daily_dashboards'
});

dailyDashboardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

dailyDashboardSchema.index({ date: 1, unitId: 1 }, { unique: true });

dailyDashboardSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('DailyDashboard', dailyDashboardSchema);