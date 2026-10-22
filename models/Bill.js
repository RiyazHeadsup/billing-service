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
      },
      app: {
        type: Number,
        default: 0
      }
    },
    activePaymentMethods: [{
      method: {
        type: String,
        enum: ['CASH', 'CARD', 'UPI', 'WALLET', 'APP']
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
      discountType: String,
      value: Number,
      source: String,
      amount: Number
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
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
      discountType: String,
      value: Number,
      source: String,
      amount: Number
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff'
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
      ref: 'Staff'
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
  appDiscount: {
    type: Number,
    default: 0
  },
  appPaymentCompleted: {
    type: Boolean,
    default: false
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
    enum: ['QUICK_SALE', 'DETAILED_SALE', 'SERVICE_SALE', 'AUTO_SALE', 'APPOINTMENT'],
    default: 'QUICK_SALE'
  },
  billStatus: {
    type: String,
    enum: ['COMPLETED', 'PENDING', 'CANCELLED', 'REFUNDED', 'APPOINTMENT'],
    default: 'COMPLETED'
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  },
  slotStart: {
    type: String
  },
  slotEnd: {
    type: String
  },
  // Where an appointment came from. Unset on bills made before this existed.
  source: {
    type: String,
    enum: ['APP', 'PANEL', 'WALKIN', 'PHONE']
  },
  // How an appointment will be paid
  paymentMode: {
    type: String,
    enum: ['ONLINE', 'PAY_AT_SALON']
  },
  // App bookings: did the customer pick the stylist, or was the first free one used?
  staffChoice: {
    type: String,
    enum: ['CLIENT', 'AUTO']
  },
  cancelledBy: {
    type: String,
    enum: ['CLIENT', 'SALON']
  },
  cancelReason: {
    type: String,
    trim: true
  },
  cancelledAt: Date,
  // Salon has seen an app booking (panel App Bookings "Accept"). App bookings
  // are auto-confirmed for the customer; this only stops the panel alert.
  acceptance: {
    at: Date,
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Set when the appointment reminder push is sent; cleared on reschedule
  reminderSentAt: Date,
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

const toCode = (code) => String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Each salon gets its own bill series: <UNITCODE>-<YEAR>-<SEQ>, starting at 1 every year.
// Bills without a salon keep the old shared BILL-<YEAR>-<SEQ> series.
async function nextBillNumber(bill) {
  const year = new Date().getFullYear();
  const unitId = bill.unitId || (bill.business && bill.business.unitId);

  if (!unitId) {
    const counter = await Counter.findOneAndUpdate(
      { name: 'billNumber' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    return `BILL-${year}-${counter.seq}`;
  }

  const Unit = require('./Unit');
  const units = await Unit.find({}).select('unitCode').lean();
  const own = units.find(u => String(u._id) === String(unitId));
  let prefix = toCode(own && own.unitCode);
  // Unit codes are typed by hand: if blank, or the same as an OLDER salon's code, add part of the salon id
  // so two salons never produce the same bill number (billNumber is unique). The older salon keeps its
  // plain prefix, so creating a new salon never changes an existing salon's numbering.
  const clash = prefix && units.some(u => String(u._id) < String(unitId) && toCode(u.unitCode) === prefix);
  if (!prefix || clash) {
    prefix = [prefix, String(unitId).slice(-4).toUpperCase()].filter(Boolean).join('-');
  }

  const counter = await Counter.findOneAndUpdate(
    { name: `billNumber:${unitId}:${year}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${year}-${counter.seq}`;
}

billSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      if (!this.transactionId) {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 11);
        this.transactionId = `TXN-${timestamp}-${randomStr}`;
      }

      if (!this.billNumber) {
        this.billNumber = await nextBillNumber(this);
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