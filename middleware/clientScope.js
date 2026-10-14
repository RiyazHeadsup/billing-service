const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Bill = require('../models/Bill');
const Client = require('../models/Client');
const ClientAddress = require('../models/ClientAddress');
const Wallet = require('../models/Wallet');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');

// The gateway sets `x-client-id` only for customer (OTP-login) tokens, after
// stripping any value the caller sent. Requests without it are staff/admin and
// pass through untouched.
//
// For customer requests every client reference in the body is overwritten with
// the header value, and update/delete targets are checked for ownership before
// the controller runs. Callers already send their own id in these fields, so
// overwriting doesn't change behaviour for honest callers.

const notFound = (res) => res.status(404).json({ success: false, statusCode: 404, message: 'Not found' });

// Combine the caller's filter with the ownership filter. `$and` so a caller's
// own `$or` or `_id` can't widen it.
const within = (search, owner) => ({ $and: [search && typeof search === 'object' ? search : {}, owner] });

// Bookings and bills store the client as `client.id` (String) and/or
// `client._id` (ObjectId). Staff-made docs may have only one of them.
const bookingOwner = (cid) => ({ $or: [{ 'client.id': cid }, { 'client._id': cid }] });

// Bills are created at the counter against a Client of that unit, and a person
// has one Client per unit, so the token's clientId can differ from the bill's.
// Match on phone number as well.
const billOwner = async (cid) => {
  const client = await Client.findById(cid).select('phoneNumber').lean();
  const or = [{ 'client.id': cid }, { 'client._id': cid }];
  if (client?.phoneNumber) or.push({ 'client.phoneNumber': client.phoneNumber });
  return { $or: or };
};

const ownsCartItem = (cid, _id) =>
  mongoose.isValidObjectId(_id) && Booking.exists({ _id, bookingStatus: 'IN_CART', ...bookingOwner(cid) });

// Each rule (req, res, cid) may rewrite req.body, or send a response to stop
// the request.
const rules = {
  // ── cart ──
  '/addToCart': (req, res, cid) => {
    const { name, phoneNumber } = req.body.client || {};
    req.body.client = { _id: cid, id: cid, name, phoneNumber };
    for (const k of ['paymentDone', 'payment', 'billId', 'isAccepted', 'bookingStatus', 'status']) delete req.body[k];
  },
  '/getCart': (req, res, cid) => { req.body.clientId = cid; },
  '/clearCart': (req, res, cid) => { req.body.clientId = cid; },
  '/updateCart': async (req, res, cid) => {
    if (!(await ownsCartItem(cid, req.body._id))) return notFound(res);
    delete req.body.client;
    delete req.body.billId;
  },
  '/removeFromCart': async (req, res, cid) => {
    if (!(await ownsCartItem(cid, req.body._id))) return notFound(res);
  },

  // ── bookings ──
  '/bookWithSubscription': (req, res, cid) => { req.body.clientId = cid; },
  '/getBookingsByClient': (req, res, cid) => { req.body.clientId = cid; },
  '/searchBooking': (req, res, cid) => { req.body.search = within(req.body.search, bookingOwner(cid)); },
  '/cancelBooking': async (req, res, cid) => {
    const { _id } = req.body;
    const ok = mongoose.isValidObjectId(_id) && await Booking.exists({
      _id, ...bookingOwner(cid), bookingStatus: { $in: ['PENDING', 'CONFIRMED'] }
    });
    if (!ok) return notFound(res);
    req.body.cancelledBy = cid;
  },
  '/rescheduleBooking': async (req, res, cid) => {
    const { _id } = req.body;
    const ok = mongoose.isValidObjectId(_id) && await Booking.exists({
      _id, ...bookingOwner(cid), bookingStatus: { $in: ['PENDING', 'CONFIRMED'] }
    });
    if (!ok) return notFound(res);
  },

  // ── payments ──
  // Amounts come from our own records, never the request.
  // TODO: initiateBookingPayment still trusts `amount` — cart prices are set by
  // the caller at addToCart. Server-side pricing lands with Phase 1.2.
  '/initiatePayment': async (req, res, cid) => {
    req.body.clientId = cid;
    const { billId } = req.body;
    if (!mongoose.isValidObjectId(billId)) {
      return res.status(400).json({ success: false, statusCode: 400, message: 'billId is required' });
    }
    const bill = await Bill.findOne({ _id: billId, ...(await billOwner(cid)) })
      .select('calculations.totals.grandTotal payment.totalPaid appPaymentCompleted').lean();
    if (!bill) return notFound(res);
    if (bill.appPaymentCompleted) {
      return res.status(409).json({ success: false, statusCode: 409, message: 'Bill already paid' });
    }
    // Same figure the app shows on the Pay button
    req.body.amount = Math.round(bill.calculations?.totals?.grandTotal || bill.payment?.totalPaid || 0);
    if (!(req.body.amount > 0)) {
      return res.status(400).json({ success: false, statusCode: 400, message: 'Nothing to pay on this bill' });
    }
    delete req.body.bookingId;
  },
  '/initiateBookingPayment': (req, res, cid) => { req.body.clientId = cid; },
  '/initiateSubscriptionPayment': async (req, res, cid) => {
    const { subscriptionId, unitId } = req.body;
    const plan = mongoose.isValidObjectId(subscriptionId) &&
      await Subscription.findOne({ _id: subscriptionId, isActive: { $ne: false } }).lean();
    if (!plan) return notFound(res);

    // Same maths as the app's SubscriptionDetailScreen
    const taxAmount = plan.taxInclusive
      ? Math.round((plan.price * plan.taxPercentage) / (100 + plan.taxPercentage))
      : Math.round((plan.price * plan.taxPercentage) / 100);
    const totalAmount = Math.round(plan.taxInclusive ? plan.price : plan.price + taxAmount);

    req.body = {
      clientId: cid,
      subscriptionId: plan._id,
      unitId,
      planName: plan.name,
      planPrice: plan.price,
      taxAmount,
      totalAmount,
      durationInDays: plan.durationInDays,
      totalServicesAllowed: plan.totalServicesAllowed,
      serviceUsage: (plan.serviceRules || []).map(r => ({
        serviceId: r.serviceId,
        categoryId: r.categoryId,
        subCategoryId: r.subCategoryId,
        maxAllowed: r.maxAllowed ?? -1,
        used: 0
      })),
      complementaryUsage: (plan.complementaryServices || []).map(c => ({
        serviceId: c.serviceId,
        maxUsage: c.maxUsage ?? -1,
        used: 0
      }))
    };
  },
  '/getPaymentStatus': async (req, res, cid) => {
    const { orderId } = req.body;
    if (!orderId || !(await Payment.exists({ orderId: String(orderId), clientId: cid }))) return notFound(res);
  },

  // ── addresses ──
  '/addClientAddress': (req, res, cid) => { req.body.clientId = cid; },
  '/searchClientAddress': (req, res, cid) => {
    req.body.search = within(req.body.search, { clientId: cid });
    delete req.body.populate;
  },
  '/updateClientAddress': async (req, res, cid) => {
    const { _id } = req.body;
    if (!(mongoose.isValidObjectId(_id) && await ClientAddress.exists({ _id, clientId: cid }))) return notFound(res);
    delete req.body.clientId;
  },
  '/deleteClientAddress': async (req, res, cid) => {
    const { _id } = req.body;
    if (!(mongoose.isValidObjectId(_id) && await ClientAddress.exists({ _id, clientId: cid }))) return notFound(res);
  },

  // ── coupons ──
  '/searchCoupon': (req) => { delete req.body.populate; },

  // ── bills (scan & pay) ──
  '/searchBill': async (req, res, cid) => {
    req.body.search = within(req.body.search, await billOwner(cid));
  },
  // The app marks its own bill paid after paying. It must have a successful
  // payment for this bill (Paytm or Cashfree, verified with the gateway).
  // Anything else on the body (amounts, memberships, wallet methods) would run
  // staff-only side effects, so the update is reduced to the completion flags.
  '/updateBill': async (req, res, cid) => {
    const { _id } = req.body;
    if (!(mongoose.isValidObjectId(_id) && await Bill.exists({ _id, ...(await billOwner(cid)) }))) return notFound(res);
    if (!(await Payment.exists({ billId: _id, clientId: cid, paymentStatus: 'TXN_SUCCESS' }))) {
      return res.status(402).json({ success: false, statusCode: 402, message: 'No successful payment for this bill' });
    }
    req.body = { _id, status: 'completed', billStatus: 'COMPLETED', appPaymentCompleted: true };
  },

  // ── wallet ──
  '/searchWallet': (req, res, cid) => {
    req.body.search = within(req.body.search, { clientId: cid });
    delete req.body.populate;
  },
  '/getWalletTransactionsByClient': (req, res, cid) => { req.body.clientId = cid; },
  '/getActiveWalletOtp': (req, res, cid) => { req.body.clientId = cid; },
  '/generateWalletOtp': async (req, res, cid) => {
    req.body.clientId = cid;
    const { walletId } = req.body;
    if (!(mongoose.isValidObjectId(walletId) && await Wallet.exists({ _id: walletId, clientId: cid }))) return notFound(res);
  }
};

// Cashfree uses the same checks as Paytm
rules['/initiateCashfreePayment'] = rules['/initiatePayment'];
rules['/getCashfreeOrderStatus'] = rules['/getPaymentStatus'];

const clientScope = async (req, res, next) => {
  const cid = req.headers['x-client-id'];
  if (!cid) return next();

  if (!mongoose.isValidObjectId(cid)) {
    return res.status(401).json({ success: false, statusCode: 401, message: 'Invalid client' });
  }

  const rule = rules[req.path];
  if (!rule) return next();

  try {
    req.body = req.body || {};
    await rule(req, res, cid);
    if (!res.headersSent) next();
  } catch (error) {
    console.error('[CLIENT_SCOPE]', req.path, error);
    res.status(500).json({ success: false, statusCode: 500, message: 'Request failed' });
  }
};

module.exports = { clientScope };
