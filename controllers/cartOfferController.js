const mongoose = require('mongoose');
const CartOffer = require('../models/CartOffer');
const Bill = require('../models/Bill');
const Service = require('../models/Service');
const Unit = require('../models/Unit');
const { evaluateCart, CartOfferError, goalLabel, isLive } = require('../services/cartOffers');

// Cart offers: panel set-up (App Control → Cart Offers) and the app's cart
// check. Panel routes refuse customer (x-client-id) requests; the cart check
// takes an optional customer so limits can be applied.

const fail = (res, status, message, code) => res.status(status).json({ success: false, statusCode: status, message, ...(code && { code }) });

const staffOnly = (req, res) => {
  if (req.headers['x-client-id']) {
    fail(res, 403, 'Not allowed');
    return false;
  }
  return true;
};

const oid = (v) => mongoose.isValidObjectId(v) ? String(v) : null;
const oidList = (v) => [...new Set((Array.isArray(v) ? v : []).map(oid).filter(Boolean))];

// Validate and normalise an offer from the panel. Returns { doc } or { error }.
const cleanOffer = async (body) => {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return { error: 'Title is required' };
  if (title.length > 60) return { error: 'Title must be 60 characters or less' };

  const groupId = oid(body.groupId);
  if (!groupId) return { error: 'Pick the menu (service group)' };

  const trigger = body.trigger || {};
  if (!['CART_VALUE', 'SERVICE_COUNT'].includes(trigger.type)) return { error: 'Pick the goal type' };
  const min = Number(trigger.min);
  if (!(min > 0)) return { error: 'Goal must be more than 0' };
  if (trigger.type === 'SERVICE_COUNT' && !Number.isInteger(min)) return { error: 'Number of services must be a whole number' };

  const reward = body.reward || {};
  if (!['FREE_SERVICE', 'SERVICE_DISCOUNT', 'CART_DISCOUNT'].includes(reward.type)) return { error: 'Pick the reward type' };
  const cleanReward = { type: reward.type };
  if (reward.type !== 'CART_DISCOUNT') {
    cleanReward.serviceId = oid(reward.serviceId);
    if (!cleanReward.serviceId) return { error: 'Pick the reward service' };
  }
  if (reward.type !== 'FREE_SERVICE') {
    if (!['percentage', 'fixed'].includes(reward.discountType)) return { error: 'Pick % or ₹ for the discount' };
    const value = Number(reward.value);
    if (!(value > 0)) return { error: 'Discount must be more than 0' };
    if (reward.discountType === 'percentage' && value > 100) return { error: 'Discount can be at most 100%' };
    Object.assign(cleanReward, { discountType: reward.discountType, value });
    const cap = Number(reward.maxDiscount) || 0;
    if (cap < 0) return { error: 'Max discount cannot be negative' };
    if (reward.discountType === 'percentage' && cap > 0) cleanReward.maxDiscount = cap;
  }

  const eligibleServiceIds = oidList(body.eligibleServiceIds);
  const suggestedServiceIds = oidList(body.suggestedServiceIds).slice(0, 6);
  const unitIds = oidList(body.unitIds);

  // Every service must be on the chosen menu
  const serviceIds = [...new Set([...eligibleServiceIds, ...suggestedServiceIds, ...(cleanReward.serviceId ? [cleanReward.serviceId] : [])])];
  if (serviceIds.length) {
    const onMenu = await Service.countDocuments({ _id: { $in: serviceIds }, groupId });
    if (onMenu !== serviceIds.length) return { error: 'All services must be from the chosen menu' };
  }
  if (cleanReward.serviceId && eligibleServiceIds.length === 1 && eligibleServiceIds[0] === cleanReward.serviceId) {
    return { error: 'The reward service cannot be the only service that counts toward the goal' };
  }
  if (unitIds.length) {
    const onGroup = await Unit.countDocuments({ _id: { $in: unitIds }, $or: [{ appServiceGroupId: groupId }, { serviceGroupId: groupId }] });
    if (onGroup !== unitIds.length) return { error: 'All salons must use the chosen menu' };
  }

  const startAt = body.startAt ? new Date(body.startAt) : null;
  const endAt = body.endAt ? new Date(body.endAt) : null;
  if ((startAt && isNaN(startAt)) || (endAt && isNaN(endAt))) return { error: 'Invalid start or end date' };
  if (startAt && endAt && endAt <= startAt) return { error: 'End must be after start' };

  const whole = (v) => Math.max(Math.floor(Number(v) || 0), 0);
  return {
    doc: {
      title,
      description: typeof body.description === 'string' ? body.description.trim().slice(0, 200) : '',
      groupId,
      unitIds,
      trigger: { type: trigger.type, min },
      eligibleServiceIds,
      reward: cleanReward,
      suggestedServiceIds,
      startAt,
      endAt,
      firstVisitOnly: body.firstVisitOnly === true,
      perClientLimit: whole(body.perClientLimit),
      totalLimit: whole(body.totalLimit),
      priority: Math.round(Number(body.priority) || 0),
      isActive: body.isActive !== false
    }
  };
};

const addCartOffer = async (req, res) => {
  if (!staffOnly(req, res)) return;
  try {
    const { doc, error } = await cleanOffer(req.body);
    if (error) return fail(res, 400, error);
    const offer = await CartOffer.create({ ...doc, createdBy: oid(req.body.createdBy) || undefined });
    res.status(201).json({ success: true, statusCode: 201, message: 'Offer created', data: offer });
  } catch (error) {
    console.error('[addCartOffer]', error);
    fail(res, 500, 'Something went wrong');
  }
};

// Body: full offer, or just { _id, isActive } to pause/resume
const updateCartOffer = async (req, res) => {
  if (!staffOnly(req, res)) return;
  try {
    const _id = oid(req.body._id);
    if (!_id) return fail(res, 400, 'Valid _id is required');
    const keys = Object.keys(req.body).filter(k => !['_id', 'unitId'].includes(k));
    let update;
    if (keys.length === 1 && keys[0] === 'isActive') {
      update = { isActive: req.body.isActive === true };
    } else {
      const { doc, error } = await cleanOffer(req.body);
      if (error) return fail(res, 400, error);
      update = doc;
    }
    const offer = await CartOffer.findByIdAndUpdate(_id, { $set: update }, { new: true }).lean();
    if (!offer) return fail(res, 404, 'Offer not found');
    res.json({ success: true, statusCode: 200, message: 'Offer updated', data: offer });
  } catch (error) {
    console.error('[updateCartOffer]', error);
    fail(res, 500, 'Something went wrong');
  }
};

// Offers used by bookings are kept for their stats; pause them instead
const deleteCartOffer = async (req, res) => {
  if (!staffOnly(req, res)) return;
  try {
    const _id = oid(req.body._id);
    if (!_id) return fail(res, 400, 'Valid _id is required');
    const used = await Bill.countDocuments({ 'appliedOffer.offerId': _id });
    if (used) return fail(res, 409, `Used in ${used} booking${used === 1 ? '' : 's'}. Pause it instead so its results stay.`, 'IN_USE');
    const gone = await CartOffer.findByIdAndDelete(_id);
    if (!gone) return fail(res, 404, 'Offer not found');
    res.json({ success: true, statusCode: 200, message: 'Offer deleted' });
  } catch (error) {
    console.error('[deleteCartOffer]', error);
    fail(res, 500, 'Something went wrong');
  }
};

const stateOf = (offer, used, now) => {
  if (offer.isActive === false) return 'PAUSED';
  if (offer.endAt && new Date(offer.endAt) < now) return 'EXPIRED';
  if (offer.startAt && new Date(offer.startAt) > now) return 'SCHEDULED';
  if (offer.totalLimit > 0 && used >= offer.totalLimit) return 'SOLD_OUT';
  return isLive(offer, now) ? 'LIVE' : 'PAUSED';
};

const cancelledExpr = { $or: [{ $eq: ['$billStatus', 'CANCELLED'] }, { $eq: ['$status', 'cancelled'] }] };

// Body: { page?, limit?, _id?, groupId?, unitId? } → offers with names and results
const searchCartOffers = async (req, res) => {
  if (!staffOnly(req, res)) return;
  try {
    const page = Math.max(parseInt(req.body.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.body.limit, 10) || 50, 100);
    const filter = {};
    if (oid(req.body._id)) filter._id = req.body._id;
    if (oid(req.body.groupId)) filter.groupId = req.body.groupId;
    if (oid(req.body.unitId)) filter.$or = [{ unitIds: { $size: 0 } }, { unitIds: new mongoose.Types.ObjectId(String(req.body.unitId)) }];

    const [offers, totalDocs] = await Promise.all([
      CartOffer.find(filter).sort({ isActive: -1, priority: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CartOffer.countDocuments(filter)
    ]);

    const offerIds = offers.map(o => o._id);
    const serviceIds = [...new Set(offers.flatMap(o => [o.reward?.serviceId, ...(o.eligibleServiceIds || []), ...(o.suggestedServiceIds || [])]).filter(Boolean).map(String))];
    const unitIds = [...new Set(offers.flatMap(o => o.unitIds || []).map(String))];

    const [services, units, stats] = await Promise.all([
      Service.find({ _id: { $in: serviceIds } }).select('name price').lean(),
      Unit.find({ _id: { $in: unitIds } }).select('unitName').lean(),
      Bill.aggregate([
        { $match: { 'appliedOffer.offerId': { $in: offerIds } } },
        {
          $group: {
            _id: '$appliedOffer.offerId',
            bookings: { $sum: { $cond: [cancelledExpr, 0, 1] } },
            cancelled: { $sum: { $cond: [cancelledExpr, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$billStatus', 'COMPLETED'] }, 1, 0] } },
            revenue: { $sum: { $cond: [{ $eq: ['$billStatus', 'COMPLETED'] }, '$calculations.totals.grandTotal', 0] } },
            saving: { $sum: { $cond: [cancelledExpr, 0, '$appliedOffer.saving'] } },
            avgValue: { $avg: { $cond: [cancelledExpr, null, '$calculations.totals.grandTotal'] } }
          }
        }
      ])
    ]);
    const svc = new Map(services.map(s => [String(s._id), s]));
    const unitName = new Map(units.map(u => [String(u._id), u.unitName]));
    const statOf = new Map(stats.map(s => [String(s._id), s]));

    // Average app booking without an offer (last 90 days), to compare against
    const [baseline] = await Bill.aggregate([
      {
        $match: {
          billType: 'APPOINTMENT', source: 'APP', 'appliedOffer.offerId': { $exists: false },
          status: { $ne: 'cancelled' }, billStatus: { $ne: 'CANCELLED' },
          createdAt: { $gte: new Date(Date.now() - 90 * 86400000) },
          ...(oid(req.body.unitId) && { unitId: new mongoose.Types.ObjectId(String(req.body.unitId)) })
        }
      },
      { $group: { _id: null, bookings: { $sum: 1 }, avgValue: { $avg: '$calculations.totals.grandTotal' } } }
    ]);

    const now = new Date();
    const docs = offers.map(o => {
      const s = statOf.get(String(o._id)) || {};
      const named = (id) => (svc.get(String(id)) ? { _id: String(id), name: svc.get(String(id)).name, price: svc.get(String(id)).price } : { _id: String(id), name: '(removed service)', price: 0 });
      return {
        ...o,
        state: stateOf(o, s.bookings || 0, now),
        goal: goalLabel(o),
        rewardService: o.reward?.serviceId ? named(o.reward.serviceId) : null,
        eligibleServices: (o.eligibleServiceIds || []).map(named),
        suggestedServices: (o.suggestedServiceIds || []).map(named),
        units: (o.unitIds || []).map(id => ({ _id: String(id), unitName: unitName.get(String(id)) || '(removed salon)' })),
        stats: {
          bookings: s.bookings || 0,
          cancelled: s.cancelled || 0,
          completed: s.completed || 0,
          revenue: Math.round(s.revenue || 0),
          saving: Math.round(s.saving || 0),
          avgValue: s.avgValue ? Math.round(s.avgValue) : null
        }
      };
    });

    res.json({
      success: true,
      statusCode: 200,
      data: {
        docs, totalDocs, page, limit,
        totalPages: Math.max(Math.ceil(totalDocs / limit), 1),
        baseline: baseline ? { bookings: baseline.bookings, avgValue: Math.round(baseline.avgValue || 0) } : { bookings: 0, avgValue: null }
      }
    });
  } catch (error) {
    console.error('[searchCartOffers]', error);
    fail(res, 500, 'Something went wrong');
  }
};

// App cart check. Body: { unitId, serviceIds }. Customer optional (x-client-id).
// Also reachable without login through the gateway's /public/getCartOffers.
const cartOffers = async (req, res) => {
  try {
    const data = await evaluateCart({ unitId: req.body.unitId, serviceIds: req.body.serviceIds, clientId: req.headers['x-client-id'] });
    res.json({ success: true, statusCode: 200, data });
  } catch (error) {
    if (error instanceof CartOfferError) return fail(res, error.status, error.message);
    console.error('[cartOffers]', error);
    fail(res, 500, 'Something went wrong');
  }
};

// Panel preview: what a cart would get at a salon. Body: { unitId, serviceIds }
const previewCartOffers = async (req, res) => {
  if (!staffOnly(req, res)) return;
  try {
    const data = await evaluateCart({ unitId: req.body.unitId, serviceIds: req.body.serviceIds });
    res.json({ success: true, statusCode: 200, data });
  } catch (error) {
    if (error instanceof CartOfferError) return fail(res, error.status, error.message);
    console.error('[previewCartOffers]', error);
    fail(res, 500, 'Something went wrong');
  }
};

module.exports = { addCartOffer, updateCartOffer, deleteCartOffer, searchCartOffers, cartOffers, previewCartOffers };
