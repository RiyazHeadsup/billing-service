const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  transactionId: {
    type: String,
    index: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    index: true
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    index: true
  },
  clientId: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentGateway: {
    type: String,
    enum: ['paytm', 'razorpay', 'other'],
    default: 'paytm'
  },
  paymentStatus: {
    type: String,
    enum: ['INITIATED', 'TXN_SUCCESS', 'TXN_FAILURE', 'PENDING', 'REFUNDED'],
    default: 'INITIATED',
    index: true
  },
  paymentMode: {
    type: String
  },
  gatewayResponse: {
    txnId: String,
    bankTxnId: String,
    bankName: String,
    gatewayName: String,
    respCode: String,
    respMsg: String,
    txnDate: String
  },
  txnToken: {
    type: String
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  refundId: {
    type: String
  },
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'payments'
});

paymentSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Payment', paymentSchema);
