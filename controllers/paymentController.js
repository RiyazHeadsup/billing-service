const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Bill = require('../models/Bill');
const ClientSubscription = require('../models/ClientSubscription');
const SubscriptionTransaction = require('../models/SubscriptionTransaction');
const paytmService = require('../services/paytmService');
const cashfreeService = require('../services/cashfreeService');

// Auto-activate subscription after successful payment
async function activateSubscription(payment, paymentMode) {
  try {
    if (!payment.subscriptionId || !payment.subscriptionMeta) return;

    // Check if already activated (prevent duplicates)
    const existing = await ClientSubscription.findOne({ paymentId: payment._id });
    if (existing) return;

    const meta = payment.subscriptionMeta;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (meta.durationInDays || 30));

    const clientSub = new ClientSubscription({
      clientId: payment.clientId,
      subscriptionId: payment.subscriptionId,
      planName: meta.planName,
      planPrice: meta.planPrice,
      taxAmount: meta.taxAmount || 0,
      totalPaid: meta.totalAmount,
      startDate,
      endDate,
      totalServicesAllowed: meta.totalServicesAllowed || -1,
      serviceUsage: meta.serviceUsage || [],
      complementaryUsage: meta.complementaryUsage || [],
      status: 'active',
      paymentId: payment._id,
      paymentMethod: paymentMode || '',
      transactionId: payment.transactionId,
      unitId: payment.unitId || null,
    });
    await clientSub.save();
    console.log(`Subscription activated for client ${payment.clientId}, plan: ${meta.planName}, orderId: ${payment.orderId}`);
  } catch (err) {
    console.error('Failed to activate subscription:', err.message);
  }
}

// Deduct subscription usage and create transactions when booking is confirmed
async function deductSubscriptionUsage(booking) {
  try {
    const services = booking.services || [];
    for (const svc of services) {
      if (!svc.coveredBySubscription || !svc.subscriptionId || !svc.freeQty) continue;

      const clientSub = await ClientSubscription.findById(svc.subscriptionId);
      if (!clientSub || clientSub.status !== 'active') continue;

      // Deduct usage
      await ClientSubscription.findByIdAndUpdate(svc.subscriptionId, {
        $inc: { totalServicesUsed: svc.freeQty }
      });

      // Create transaction record
      await SubscriptionTransaction.create({
        clientSubscriptionId: clientSub._id,
        clientId: clientSub.clientId,
        subscriptionId: clientSub.subscriptionId,
        type: 'service',
        serviceId: svc.id,
        serviceName: svc.name,
        bookingId: booking._id,
        servicePrice: svc.pricing?.basePrice || 0,
        discountApplied: (svc.pricing?.basePrice || 0) * svc.freeQty,
        freeQty: svc.freeQty,
        unitId: booking.unitId || null,
        status: 'completed',
        remarks: `Redeemed ${svc.freeQty}x ${svc.name} via ${clientSub.planName}`,
      });

      console.log(`Subscription ${svc.subscriptionId}: deducted ${svc.freeQty}x ${svc.name} for booking ${booking._id}`);
    }
  } catch (err) {
    console.error('Failed to deduct subscription usage:', err.message);
  }
}

// Run once, when a payment first turns TXN_SUCCESS: confirm every booking it
// paid for, settle the bill, activate the subscription.
async function applySuccess(payment, paymentMode) {
  const bookingIds = payment.bookingIds?.length ? payment.bookingIds : [payment.bookingId].filter(Boolean);
  for (const bookingId of bookingIds) {
    const booking = await Booking.findByIdAndUpdate(bookingId, {
      bookingStatus: 'CONFIRMED',
      status: 'confirmed',
      paymentDone: true,
      'payment.paymentStatus': 'Paid',
      'payment.totalPaid': payment.amount,
      'payment.activePaymentMethods': [{ method: paymentMode || 'ONLINE', amount: payment.amount }]
    }, { new: true });
    if (booking) await deductSubscriptionUsage(booking);
    console.log(`Booking ${bookingId} confirmed for order: ${payment.orderId}`);
  }

  if (payment.billId) {
    await Bill.findByIdAndUpdate(payment.billId, {
      appPaymentCompleted: true,
      'payment.paymentStatus': 'Paid',
    });
    console.log(`Bill ${payment.billId} appPaymentCompleted set to true for order: ${payment.orderId}`);
  }

  if (payment.subscriptionId) {
    await activateSubscription(payment, paymentMode);
  }
}

const GATEWAY_STATUSES = ['TXN_SUCCESS', 'TXN_FAILURE', 'PENDING'];

// Gateway answers, normalised: { status, amount, txnId, paymentMode, response, raw }.
// status is TXN_SUCCESS | TXN_FAILURE | PENDING, or null when the gateway has
// nothing usable (leave the payment as it is).
const paytmStatus = async (payment) => {
  const g = (await paytmService.getTransactionStatus(payment.orderId)).body || {};
  const status = g.resultInfo?.resultStatus;
  return {
    status: GATEWAY_STATUSES.includes(status) ? status : null,
    amount: g.txnAmount,
    txnId: g.txnId,
    paymentMode: g.paymentMode,
    response: {
      txnId: g.txnId, bankTxnId: g.bankTxnId, bankName: g.bankName, gatewayName: g.gatewayName,
      respCode: g.resultInfo?.resultCode, respMsg: g.resultInfo?.resultMsg, txnDate: g.txnDate
    },
    raw: g
  };
};

const CASHFREE_STATUS = { PAID: 'TXN_SUCCESS', ACTIVE: 'PENDING', EXPIRED: 'TXN_FAILURE', TERMINATED: 'TXN_FAILURE', TERMINATION_REQUESTED: 'TXN_FAILURE' };

const cashfreeStatus = async (payment) => {
  const order = await cashfreeService.fetchOrder(payment.orderId);
  const status = CASHFREE_STATUS[order?.order_status] || null;
  let paid = null;
  if (status === 'TXN_SUCCESS') {
    const payments = await cashfreeService.fetchPayments(payment.orderId);
    paid = (Array.isArray(payments) ? payments : []).find(p => p.payment_status === 'SUCCESS') || null;
  }
  return {
    status,
    amount: order?.order_amount,
    txnId: paid?.cf_payment_id ? String(paid.cf_payment_id) : undefined,
    paymentMode: paid?.payment_group,
    response: {
      txnId: paid?.cf_payment_id ? String(paid.cf_payment_id) : undefined,
      bankTxnId: paid?.bank_reference,
      gatewayName: 'cashfree',
      respCode: order?.order_status,
      respMsg: paid?.payment_message || order?.order_status,
      txnDate: paid?.payment_time
    },
    raw: { order_id: order?.order_id, order_status: order?.order_status, order_amount: order?.order_amount, gateway: 'cashfree' }
  };
};

// The only place a payment's status is decided. Asks the payment's gateway
// (Paytm or Cashfree) for the order's status server-side; whatever a browser,
// app or callback body claims is never used. A success whose amount doesn't
// match what we initiated is held as PENDING for a person to look at.
async function syncWithGateway(orderId) {
  const payment = await Payment.findOne({ orderId: String(orderId) });
  if (!payment) return { payment: null, gateway: null };

  const result = payment.paymentGateway === 'cashfree' ? await cashfreeStatus(payment) : await paytmStatus(payment);
  let { status } = result;
  if (!status) return { payment, gateway: result.raw };

  if (status === 'TXN_SUCCESS' && Math.abs(Number(result.amount) - Number(payment.amount)) > 0.01) {
    console.error(`[PAYMENT] Amount mismatch for ${payment.orderId}: paid ${result.amount}, expected ${payment.amount}`);
    status = 'PENDING';
  }

  if (payment.paymentStatus === 'TXN_SUCCESS') return { payment, gateway: result.raw };

  payment.paymentStatus = status;
  payment.transactionId = result.txnId || payment.transactionId;
  payment.paymentMode = result.paymentMode || payment.paymentMode;
  payment.gatewayResponse = { ...payment.gatewayResponse, ...result.response };
  await payment.save();

  if (status === 'TXN_SUCCESS') await applySuccess(payment, result.paymentMode);
  return { payment, gateway: result.raw };
}

class PaymentController {
  // Initiate payment for any purpose (standalone)
  async initiatePayment(req, res) {
    try {
      const { amount, clientId, bookingId, billId, unitId, createdBy, remarks } = req.body;

      if (!amount || !clientId) {
        return res.status(400).json({ error: 'amount and clientId are required' });
      }

      const orderId = paytmService.generateOrderId('ORD');

      // Create payment record
      const payment = new Payment({
        orderId,
        clientId,
        amount,
        bookingId: bookingId || null,
        billId: billId || null,
        unitId: unitId || null,
        createdBy: createdBy || null,
        remarks: remarks || null,
        paymentStatus: 'INITIATED'
      });
      await payment.save();

      // Call Paytm initiate transaction
      const paytmResponse = await paytmService.initiateTransaction(orderId, amount, clientId);

      if (paytmResponse.body && paytmResponse.body.resultInfo && paytmResponse.body.resultInfo.resultStatus === 'S') {
        payment.txnToken = paytmResponse.body.txnToken;
        await payment.save();

        res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Payment initiated successfully',
          data: {
            orderId: orderId,
            txnToken: paytmResponse.body.txnToken,
            amount: amount,
            mid: paytmService.mid,
            callbackUrl: paytmService.callbackUrl,
            paymentId: payment._id
          }
        });
      } else {
        payment.paymentStatus = 'TXN_FAILURE';
        payment.gatewayResponse = {
          respCode: paytmResponse.body?.resultInfo?.resultCode,
          respMsg: paytmResponse.body?.resultInfo?.resultMsg
        };
        await payment.save();

        res.status(400).json({
          success: false,
          message: 'Payment initiation failed',
          error: paytmResponse.body?.resultInfo?.resultMsg || 'Unknown error',
          data: paytmResponse
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Initiate payment for booking (from cart flow)
  async initiateBookingPayment(req, res) {
    try {
      const { clientId, bookingIds, amount, unitId, createdBy, bookingDate, bookingTime, scheduledDate, scheduledTime, serviceType, address } = req.body;

      if (!clientId || !amount) {
        return res.status(400).json({ error: 'clientId and amount are required' });
      }

      // If bookingIds provided, validate they exist and belong to client
      let bookings = [];
      if (bookingIds && bookingIds.length > 0) {
        bookings = await Booking.find({
          _id: { $in: bookingIds },
          'client.id': clientId,
          bookingStatus: { $in: ['IN_CART', 'PENDING'] }
        });

        if (bookings.length === 0) {
          return res.status(400).json({ error: 'No valid bookings found' });
        }
      } else {
        // Get all cart items for client (include PENDING in case previous payment attempt was interrupted)
        bookings = await Booking.find({
          'client.id': clientId,
          bookingStatus: { $in: ['IN_CART', 'PENDING'] }
        });

        if (bookings.length === 0) {
          return res.status(400).json({ error: 'Cart is empty' });
        }
      }

      const orderId = paytmService.generateOrderId('BKG');

      // Save schedule details on bookings but keep them IN_CART until payment succeeds
      for (const booking of bookings) {
        if (bookingDate) booking.bookingDate = bookingDate;
        if (bookingTime) booking.bookingTime = bookingTime;
        if (scheduledDate) booking.scheduledDate = scheduledDate;
        if (scheduledTime) booking.scheduledTime = scheduledTime;
        if (serviceType) booking.serviceType = serviceType;
        if (address) booking.address = address;
        await booking.save();
      }

      // Create payment record linked to all bookings
      const payment = new Payment({
        orderId,
        clientId,
        amount,
        bookingId: bookings[0]._id,
        bookingIds: bookings.map(b => b._id),
        unitId: unitId || null,
        createdBy: createdBy || null,
        remarks: `Payment for ${bookings.length} booking(s): ${bookings.map(b => b.bookingNumber).join(', ')}`,
        paymentStatus: 'INITIATED'
      });
      await payment.save();

      // Call Paytm
      const paytmResponse = await paytmService.initiateTransaction(orderId, amount, clientId);

      if (paytmResponse.body && paytmResponse.body.resultInfo && paytmResponse.body.resultInfo.resultStatus === 'S') {
        payment.txnToken = paytmResponse.body.txnToken;
        await payment.save();

        res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Booking payment initiated',
          data: {
            orderId: orderId,
            txnToken: paytmResponse.body.txnToken,
            amount: amount,
            mid: paytmService.mid,
            callbackUrl: paytmService.callbackUrl,
            paymentId: payment._id,
            bookingNumbers: bookings.map(b => b.bookingNumber)
          }
        });
      } else {
        payment.paymentStatus = 'TXN_FAILURE';
        payment.gatewayResponse = {
          respCode: paytmResponse.body?.resultInfo?.resultCode,
          respMsg: paytmResponse.body?.resultInfo?.resultMsg
        };
        await payment.save();

        res.status(400).json({
          success: false,
          message: 'Payment initiation failed',
          error: paytmResponse.body?.resultInfo?.resultMsg || 'Unknown error'
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Initiate payment for subscription purchase
  async initiateSubscriptionPayment(req, res) {
    try {
      const { clientId, subscriptionId, planName, planPrice, taxAmount, totalAmount, unitId, durationInDays, totalServicesAllowed, serviceUsage, complementaryUsage } = req.body;

      if (!clientId || !subscriptionId || !totalAmount) {
        return res.status(400).json({ error: 'clientId, subscriptionId, and totalAmount are required' });
      }

      const orderId = paytmService.generateOrderId('SUB');

      const payment = new Payment({
        orderId,
        clientId,
        amount: totalAmount,
        unitId: unitId || null,
        remarks: `Subscription: ${planName || subscriptionId}`,
        paymentStatus: 'INITIATED',
        subscriptionId,
        subscriptionMeta: { planName, planPrice, taxAmount, totalAmount, durationInDays, totalServicesAllowed, serviceUsage, complementaryUsage }
      });
      await payment.save();

      const paytmResponse = await paytmService.initiateTransaction(orderId, totalAmount, clientId);

      if (paytmResponse.body && paytmResponse.body.resultInfo && paytmResponse.body.resultInfo.resultStatus === 'S') {
        payment.txnToken = paytmResponse.body.txnToken;
        await payment.save();

        res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Subscription payment initiated',
          data: {
            orderId,
            txnToken: paytmResponse.body.txnToken,
            amount: totalAmount,
            mid: paytmService.mid,
            callbackUrl: paytmService.callbackUrl,
            paymentId: payment._id
          }
        });
      } else {
        payment.paymentStatus = 'TXN_FAILURE';
        payment.gatewayResponse = {
          respCode: paytmResponse.body?.resultInfo?.resultCode,
          respMsg: paytmResponse.body?.resultInfo?.resultMsg
        };
        await payment.save();

        res.status(400).json({
          success: false,
          message: 'Payment initiation failed',
          error: paytmResponse.body?.resultInfo?.resultMsg || 'Unknown error'
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Paytm server-to-server callback. The body is only used to find the order;
  // the status comes from Paytm via syncWithGateway.
  async paymentCallback(req, res) {
    try {
      const callbackData = req.body;
      const orderId = callbackData.ORDERID;
      if (!orderId) return res.status(400).json({ error: 'ORDERID is required' });

      if (callbackData.CHECKSUMHASH) {
        // PaytmChecksum.verifySignature removes CHECKSUMHASH internally before verifying
        const isValid = await paytmService.verifySignature(callbackData, callbackData.CHECKSUMHASH);
        if (!isValid) {
          console.error(`Invalid checksum for order: ${orderId}`);
          return res.status(403).json({ error: 'Invalid checksum. Callback rejected.' });
        }
      }

      const { payment } = await syncWithGateway(orderId);
      if (!payment) {
        console.error(`Payment not found for order: ${orderId}`);
        return res.status(404).json({ error: 'Payment not found' });
      }

      const status = payment.paymentStatus;
      res.status(200).json({
        success: status === 'TXN_SUCCESS',
        statusCode: 200,
        message: status === 'TXN_SUCCESS' ? 'Payment successful' : 'Payment failed',
        data: {
          orderId,
          transactionId: payment.transactionId,
          status,
          amount: payment.amount,
          paymentMode: payment.paymentMode
        }
      });
    } catch (error) {
      console.error('Payment callback error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Check payment status with Paytm and apply it. Also used by the gateway's
  // /secure/* handlers.
  async getPaymentStatus(req, res) {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }

      const { payment, gateway } = await syncWithGateway(orderId);

      res.json({
        statusCode: 200,
        data: {
          localStatus: payment,
          gatewayStatus: gateway
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // ── Cashfree ──
  // Pay a bill (Scan & Pay) through Cashfree. The app opens the checkout with
  // the returned paymentSessionId using Cashfree's SDK.
  // For customers, clientScope has already set clientId and the bill's amount.
  async initiateCashfreePayment(req, res) {
    try {
      const { amount, clientId, bookingId, billId, unitId, createdBy, remarks, customerPhone, customerEmail, customerName } = req.body;
      if (!amount || !clientId) {
        return res.status(400).json({ error: 'amount and clientId are required' });
      }
      if (!cashfreeService.isConfigured()) {
        return res.status(503).json({ error: 'Cashfree not configured on server' });
      }

      const orderId = cashfreeService.generateOrderId('ORD');
      const payment = new Payment({
        orderId,
        clientId,
        amount,
        bookingId: bookingId || null,
        billId: billId || null,
        unitId: unitId || null,
        createdBy: createdBy || null,
        remarks: remarks || null,
        paymentStatus: 'INITIATED',
        paymentGateway: 'cashfree'
      });
      await payment.save();

      let order;
      try {
        order = await cashfreeService.createOrder({ orderId, amount, customerId: clientId, customerPhone, customerEmail, customerName, orderNote: remarks });
      } catch (error) {
        payment.paymentStatus = 'TXN_FAILURE';
        payment.gatewayResponse = { gatewayName: 'cashfree', respMsg: error.message };
        await payment.save();
        console.error('[Cashfree] createOrder failed:', error.data || error.message);
        return res.status(400).json({ success: false, message: 'Payment initiation failed', error: error.message });
      }

      payment.paymentSessionId = order.payment_session_id;
      await payment.save();
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Payment initiated successfully',
        data: {
          orderId,
          paymentSessionId: order.payment_session_id,
          amount,
          environment: cashfreeService.environment,
          gateway: 'cashfree',
          paymentId: payment._id
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Cashfree's server-to-server notification. The body is only used to find
  // the order; the status comes from Cashfree via syncWithGateway.
  async cashfreeWebhook(req, res) {
    try {
      const orderId = req.body?.data?.order?.order_id;
      if (!orderId) return res.status(400).json({ error: 'order_id missing' });

      const { payment } = await syncWithGateway(orderId);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });

      console.log(`[Cashfree webhook] ${req.body?.type} ${orderId} → ${payment.paymentStatus}`);
      res.status(200).json({ success: true, received: true });
    } catch (error) {
      console.error('[Cashfree webhook]', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  // Search payments
  async searchPayment(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: [
          { path: 'bookingId' },
          { path: 'billId' }
        ]
      };
      const payments = await Payment.paginate(req.body.search || {}, options);

      // Lookup client names for all payments
      const clientIds = [...new Set(payments.docs.map(p => p.clientId).filter(Boolean))];
      if (clientIds.length > 0) {
        const Client = require('../models/Client');
        const clients = await Client.find({ _id: { $in: clientIds } }, 'name phoneNumber');
        const clientMap = {};
        clients.forEach(c => { clientMap[c._id.toString()] = { name: c.name, phoneNumber: c.phoneNumber }; });
        payments.docs = payments.docs.map(p => {
          const doc = p.toObject ? p.toObject() : p;
          doc.clientInfo = clientMap[doc.clientId] || null;
          return doc;
        });
      }

      res.json({ statusCode: 200, data: payments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Get payments by client
  async getPaymentsByClient(req, res) {
    try {
      const { clientId, page = 1, limit = 10 } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: 'clientId is required' });
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: 'bookingId' },
          { path: 'billId' }
        ]
      };

      const payments = await Payment.paginate({ clientId }, options);
      res.json({ statusCode: 200, data: payments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Initiate refund
  async initiateRefund(req, res) {
    try {
      const { orderId, refundAmount, remarks } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }

      const payment = await Payment.findOne({ orderId });
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      if (payment.paymentStatus !== 'TXN_SUCCESS') {
        return res.status(400).json({ error: 'Can only refund successful payments' });
      }

      const amount = refundAmount || payment.amount;
      const refundId = `REFUND_${Date.now()}`;

      const paytmResponse = await paytmService.initiateRefund(
        orderId,
        refundId,
        payment.gatewayResponse.txnId,
        amount
      );

      if (paytmResponse.body && paytmResponse.body.resultInfo && paytmResponse.body.resultInfo.resultStatus === 'TXN_SUCCESS') {
        payment.paymentStatus = 'REFUNDED';
        payment.refundAmount = amount;
        payment.refundId = refundId;
        if (remarks) payment.remarks = remarks;
        await payment.save();

        res.json({
          statusCode: 200,
          message: 'Refund initiated successfully',
          data: {
            orderId,
            refundId,
            refundAmount: amount,
            status: 'REFUNDED'
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Refund failed',
          error: paytmResponse.body?.resultInfo?.resultMsg || 'Unknown error'
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PaymentController();
