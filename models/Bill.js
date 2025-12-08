const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const billSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    index: true
  },
  billNumber: {
    type: String,
    unique: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  billDate: {
    type: String,
    required: true
  },
  billTime: {
    type: String,
    required: true
  },
  date: {
    type: Number
  },
  client: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client'
    },
    id: String,
    name: String,
    phoneNumber: String,
    gender: String,
    ageGroup: String,
    customerType: String,
    clientType: String,
    totalVisit: {
      type: Number,
      default: 0
    },
    points: {
      type: Number,
      default: 0
    },
    createdAt: Date,
    walletId: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Wallet'
      },
      balance: {
        type: Number,
        default: 0
      },
      totalCredits: {
        type: Number,
        default: 0
      },
      totalDebits: {
        type: Number,
        default: 0
      },
      isActive: {
        type: Boolean,
        default: true
      },
      isFrozen: {
        type: Boolean,
        default: false
      }
    }
  },
  selectedMembership: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClientMembership'
  },
  membershipDetails: mongoose.Schema.Types.Mixed,
  appliedCoupon: {
    code: {
      type: String,
      uppercase: true
    },
    name: String,
    description: String,
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    discountValue: Number,
    discountAmount: Number,
    finalAmount: Number,
    maxDiscountAmount: Number,
    appliedAt: Date
  },
  payment: {
    methods: {
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
      }
    },
    activePaymentMethods: [{
      method: {
        type: String,
        enum: ['CASH', 'CARD', 'UPI', 'WALLET']
      },
      amount: Number
    }],
    totalPaid: {
      type: Number,
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ['Paid', 'Pending', 'Partial', 'Cancelled'],
      required: true
    },
    remainingAmount: {
      type: Number,
      default: 0
    }
  },
  services: [{
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service'
    },
    name: String,
    quantity: {
      type: Number,
      default: 1
    },
    pricing: {
      basePrice: Number,
      finalPrice: Number,
      totalPrice: Number,
      totalBasePrice: Number,
      savings: Number
    },
    discount: {
      type: String,
      value: Number,
      source: String,
      amount: Number
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    incentive: Number
  }],
  products: [{
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: String,
    brand: String,
    quantity: {
      type: Number,
      default: 1
    },
    pricing: {
      basePrice: Number,
      finalPrice: Number,
      totalPrice: Number,
      totalBasePrice: Number,
      mrp: Number,
      costPrice: Number,
      savings: Number
    },
    discount: {
      type: String,
      value: Number,
      source: String,
      amount: Number
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  newMemberships: [{
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ClientMembership'
    },
    membershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership'
    },
    name: String,
    type: {
      type: String,
      enum: ['value_added', 'fix_discount', 'service_discount']
    },
    duration: {
      value: Number,
      unit: {
        type: String,
        enum: ['days', 'months', 'years']
      }
    },
    description: String,
    pricing: {
      purchaseAmount: Number,
      finalPrice: Number,
      savings: Number
    },
    benefits: {
      valueAddedAmount: Number,
      fixDiscountPercentage: Number,
      excludedServices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
      }],
      serviceDiscounts: [mongoose.Schema.Types.Mixed]
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  calculations: {
    items: {
      services: {
        count: Number,
        baseTotal: Number,
        finalTotal: Number,
        totalDiscount: Number,
        discountPercentage: String
      },
      products: {
        count: Number,
        baseTotal: Number,
        finalTotal: Number,
        totalDiscount: Number,
        discountPercentage: Number
      },
      memberships: {
        count: Number,
        baseTotal: Number,
        finalTotal: Number,
        totalDiscount: Number,
        discountPercentage: Number
      }
    },
    totals: {
      totalItems: Number,
      subtotalBeforeDiscount: Number,
      subtotalAfterItemDiscount: Number,
      totalItemDiscount: Number,
      couponDiscount: Number,
      subtotalAfterCoupon: Number,
      gstAmount: Number,
      gstPercentage: Number,
      priceAreInclusiveTaxes: Boolean,
      subtotalWithGst: Number,
      roundOffAmount: Number,
      totalDiscount: Number,
      grandTotal: Number,
      totalSavings: Number,
      finalAmount: Number,
      roundoffValue: {
        type: Number,
        default: 0
      },
      amountAfterRoundoff: Number
    }
  },
  discounts: {
    hasDiscounts: {
      type: Boolean,
      default: false
    },
    membershipDiscount: {
      applied: Boolean,
      amount: Number,
      source: String
    },
    couponDiscount: {
      applied: Boolean,
      amount: Number,
      code: String
    },
    walletUsed: Boolean,
    totalDiscountAmount: Number
  },
  business: {
    name: String,
    address: String,
    phone: String,
    email: String,
    taxId: String,
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit'
    }
  },
  tax: {
    taxIncluded: {
      type: Boolean,
      default: true
    },
    taxMessage: String,
    gstApplicable: {
      type: Boolean,
      default: false
    },
    gstPercentage: {
      type: Number,
      default: 5
    },
    gstAmount: {
      type: Number,
      default: 0
    },
    taxBreakdown: [mongoose.Schema.Types.Mixed]
  },
  status: {
    type: String,
    enum: ['completed', 'cancelled', 'refunded', 'pending'],
    default: 'completed'
  },
  changeReturned: {
    type: Number,
    default: 0
  },
  remarks: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  billType: {
    type: String,
    enum: ['QUICK_SALE', 'DETAILED_SALE', 'SERVICE_SALE'],
    default: 'QUICK_SALE'
  },
  billStatus: {
    type: String,
    enum: ['COMPLETED', 'PENDING', 'CANCELLED', 'REFUNDED'],
    default: 'COMPLETED'
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  },
  domainId: String,
  collab: [{
    type: String,
    index: true
  }]
}, {
  timestamps: true,
  collection: 'bills'
});

const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  seq: {
    type: Number,
    default: 0
  }
});

const Counter = mongoose.model('Counter', counterSchema);

billSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      if (!this.transactionId) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 11);
        this.transactionId = `TXN-${timestamp}-${randomStr}`;
      }

      if (!this.billNumber) {
        const counter = await Counter.findOneAndUpdate(
          { name: 'billNumber' },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );
        
        const year = new Date().getFullYear();
        this.billNumber = `BILL-${year}-${counter.seq}`;
      }

      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

billSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Bill', billSchema);