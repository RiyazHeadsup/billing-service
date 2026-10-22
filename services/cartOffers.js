const mongoose = require('mongoose');
const CartOffer = require('../models/CartOffer');
const Bill = require('../models/Bill');
const Client = require('../models/Client');
const Service = require('../models/Service');
const Unit = require('../models/Unit');

// Works out cart offers (models/CartOffer.js) for a salon cart.
//
// Rules:
// - An offer is "met" when the cart reaches its goal: cart value (₹) or
//   number of services, counting only its eligible services when it has a
//   list. The reward service itself never counts toward its own goal, so
//   adding the free service can't unlock it.
// - FREE_SERVICE / SERVICE_DISCOUNT need the reward service in the cart; a
//   met offer whose service isn't added yet is "claimable".
// - One offer applies per booking: the met one saving most (priority breaks a
//   tie). Its saving becomes per-service fixed discounts, so Quick Sale keeps
//   it when the appointment is billed.
// - "next" is the nearest goal not reached yet that would save more than what
//   applies now; the app shows it as "Add ₹X more to unlock …".
//
// Prices always come from the Service records, never the request.

const MAX_SUGGESTIONS = 3;
// Keeps internal ₹1 menu items (refreshments, advances) out of suggestions
const MIN_SUGGEST_PRICE = 100;
const MAX_COUNT_SUGGEST_PRICE = 1000;

const round2 = (n) => Math.round(n * 100) / 100;
const rupees = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const ids = (list) => (list || []).map(String);

const isLive = (offer, now) =>
  offer.isActive !== false &&
  (!offer.startAt || new Date(offer.startAt) <= now) &&
  (!offer.endAt || new Date(offer.endAt) >= now);

// Live offers a salon runs, best first
const offersForUnit = async (unit, now = new Date()) => {
  const groupId = unit.appServiceGroupId || unit.serviceGroupId;
  if (!groupId) return [];
  const offers = await CartOffer.find({
    groupId,
    isActive: true,
    $or: [{ unitIds: { $size: 0 } }, { unitIds: unit._id }]
  }).sort({ priority: -1, createdAt: -1 }).lean();
  return offers.filter(o => isLive(o, now));
};

// Short goal line for offer lists: "On bookings of ₹1,500+"
const goalLabel = (offer) => {
  const scope = offer.eligibleServiceIds?.length ? ' on selected services' : '';
  return offer.trigger.type === 'CART_VALUE'
    ? `On bookings of ${rupees(offer.trigger.min)}+${scope}`
    : `When you book ${offer.trigger.min}+ services${scope}`;
};

// Saving from `offer` on the cart lines, or null when its reward service
// isn't in the cart. Returns { saving, lines: [{ serviceId, amount }] }.
const rewardFor = (offer, cart, rewardService) => {
  const { reward } = offer;
  if (reward.type === 'FREE_SERVICE' || reward.type === 'SERVICE_DISCOUNT') {
    const line = cart.find(s => String(s._id) === String(reward.serviceId));
    if (!line) return null;
    const price = Number(line.price) || 0;
    let amount = price;
    if (reward.type === 'SERVICE_DISCOUNT') {
      amount = reward.discountType === 'percentage' ? price * (Number(reward.value) || 0) / 100 : Number(reward.value) || 0;
      if (reward.discountType === 'percentage' && reward.maxDiscount > 0) amount = Math.min(amount, reward.maxDiscount);
    }
    amount = round2(Math.min(Math.max(amount, 0), price));
    return amount > 0 ? { saving: amount, lines: [{ serviceId: String(line._id), amount }] } : null;
  }

  // CART_DISCOUNT: off the eligible lines (all lines when there is no list)
  const eligible = ids(offer.eligibleServiceIds);
  const base = eligible.length ? cart.filter(s => eligible.includes(String(s._id))) : cart;
  const baseTotal = base.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  if (baseTotal <= 0) return null;
  let total = reward.discountType === 'percentage' ? baseTotal * (Number(reward.value) || 0) / 100 : Number(reward.value) || 0;
  if (reward.discountType === 'percentage' && reward.maxDiscount > 0) total = Math.min(total, reward.maxDiscount);
  total = round2(Math.min(Math.max(total, 0), baseTotal));
  if (total <= 0) return null;

  // Spread over the lines by price; the last line takes the rounding
  let left = total;
  const lines = base.map((s, i) => {
    const amount = i === base.length - 1 ? round2(left) : round2(total * (Number(s.price) || 0) / baseTotal);
    left -= amount;
    return { serviceId: String(s._id), amount };
  }).filter(l => l.amount > 0);
  return { saving: total, lines };
};

// What the offer would save once unlocked, for ranking "next" (estimate for
// cart discounts: taken at the goal)
const potentialSaving = (offer, cart, rewardService) => {
  const { reward } = offer;
  if (reward.type === 'CART_DISCOUNT') {
    const at = Math.max(cart.reduce((sum, s) => sum + (Number(s.price) || 0), 0), offer.trigger.type === 'CART_VALUE' ? offer.trigger.min : 0);
    let v = reward.discountType === 'percentage' ? at * (Number(reward.value) || 0) / 100 : Number(reward.value) || 0;
    if (reward.discountType === 'percentage' && reward.maxDiscount > 0) v = Math.min(v, reward.maxDiscount);
    return v;
  }
  const price = Number(rewardService?.price) || 0;
  if (reward.type === 'FREE_SERVICE') return price;
  let v = reward.discountType === 'percentage' ? price * (Number(reward.value) || 0) / 100 : Number(reward.value) || 0;
  if (reward.discountType === 'percentage' && reward.maxDiscount > 0) v = Math.min(v, reward.maxDiscount);
  return Math.min(v, price);
};

const progressOf = (offer, cart) => {
  const eligible = ids(offer.eligibleServiceIds);
  const rewardId = offer.reward.serviceId ? String(offer.reward.serviceId) : null;
  const counted = cart.filter(s => String(s._id) !== rewardId && (!eligible.length || eligible.includes(String(s._id))));
  const current = offer.trigger.type === 'CART_VALUE'
    ? counted.reduce((sum, s) => sum + (Number(s.price) || 0), 0)
    : counted.length;
  const target = offer.trigger.min;
  return { current: round2(current), target, remaining: round2(Math.max(target - current, 0)), met: current >= target };
};

// Bills that used an offer and weren't cancelled
const liveUse = (offerId) => ({
  'appliedOffer.offerId': offerId,
  status: { $ne: 'cancelled' },
  billStatus: { $ne: 'CANCELLED' }
});

// Why a customer can't use an offer right now, or null
const blockedFor = async (offer, client) => {
  if (offer.totalLimit > 0 && await Bill.countDocuments(liveUse(offer._id)) >= offer.totalLimit) return 'SOLD_OUT';
  if (!client) return null;
  const owner = { $or: [{ 'client.id': String(client._id) }, { 'client._id': client._id }, ...(client.phoneNumber ? [{ 'client.phoneNumber': client.phoneNumber }] : [])] };
  if (offer.firstVisitOnly && await Bill.exists({ ...owner, billStatus: 'COMPLETED' })) return 'NOT_FIRST_VISIT';
  if (offer.perClientLimit > 0 && await Bill.countDocuments({ ...liveUse(offer._id), ...owner }) >= offer.perClientLimit) return 'LIMIT_REACHED';
  return null;
};

const toServiceCard = (s) => ({
  id: String(s._id),
  name: s.name,
  price: Number(s.price) || 0,
  image: s.img || null,
  duration: s.service_time || null
});

// Most-booked services at a salon (last 90 days), cached for a while: the
// default suggestions. Price-sorted picks would surface internal ₹1 items.
const POPULAR_TTL_MS = 10 * 60 * 1000;
const popularCache = new Map(); // unitId → { at, ids }
const popularServiceIds = async (unitId) => {
  const key = String(unitId);
  const hit = popularCache.get(key);
  if (hit && Date.now() - hit.at < POPULAR_TTL_MS) return hit.ids;
  const rows = await Bill.aggregate([
    { $match: { unitId: new mongoose.Types.ObjectId(key), billStatus: 'COMPLETED', createdAt: { $gte: new Date(Date.now() - 90 * 86400000) } } },
    { $unwind: '$services' },
    { $group: { _id: '$services.id', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 100 }
  ]);
  const list = rows.map(r => String(r._id)).filter(Boolean);
  popularCache.set(key, { at: Date.now(), ids: list });
  return list;
};

// Services that close the gap for `offer`
const suggestionsFor = async (offer, cart, gap, groupId, unitId) => {
  const exclude = new Set([...cart.map(s => String(s._id)), ...(offer.reward.serviceId ? [String(offer.reward.serviceId)] : [])]);
  const eligible = ids(offer.eligibleServiceIds);
  const allowed = (s) => !exclude.has(String(s._id)) && (!eligible.length || eligible.includes(String(s._id)));
  const select = 'name price img service_time';

  // Chosen in the panel, in that order
  if (offer.suggestedServiceIds?.length) {
    const picked = await Service.find({ _id: { $in: offer.suggestedServiceIds }, groupId, isActive: { $ne: false } }).select(select).lean();
    const order = ids(offer.suggestedServiceIds);
    return picked.filter(allowed).sort((a, b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id)))
      .slice(0, MAX_SUGGESTIONS).map(toServiceCard);
  }

  // Popular services in a sensible price band: for a ₹ goal, ones that reach it
  // without overshooting much; for a count goal, an easy ₹100-1,000 add-on
  const [low, high] = offer.trigger.type === 'CART_VALUE'
    ? [Math.max(gap, MIN_SUGGEST_PRICE), Math.max(gap * 2, gap + 500)]
    : [MIN_SUGGEST_PRICE, MAX_COUNT_SUGGEST_PRICE];
  const popular = await popularServiceIds(unitId);
  const rank = new Map(popular.map((id, i) => [id, i]));
  let picks = (await Service.find({ _id: { $in: popular }, groupId, isActive: true, price: { $gte: low, $lte: high } }).select(select).lean())
    .filter(allowed)
    .sort((a, b) => rank.get(String(a._id)) - rank.get(String(b._id)));

  // Not enough history yet: the cheapest menu items that qualify
  if (picks.length < MAX_SUGGESTIONS) {
    const query = { groupId, isActive: true, price: { $gte: low } };
    if (eligible.length) query._id = { $in: eligible };
    const more = (await Service.find(query).select(select).sort({ price: 1 }).limit(12).lean())
      .filter(s => allowed(s) && !picks.some(p => String(p._id) === String(s._id)));
    picks = [...picks, ...more];
  }
  return picks.slice(0, MAX_SUGGESTIONS).map(toServiceCard);
};

const messageFor = {
  next: (offer, p) => offer.trigger.type === 'CART_VALUE'
    ? `Add ${rupees(p.remaining)} more to unlock ${offer.title}`
    : `Add ${p.remaining} more service${p.remaining === 1 ? '' : 's'} to unlock ${offer.title}`,
  claimable: (offer, service) => `${offer.title} unlocked! Add ${service?.name || 'it'} to claim`,
  applied: (offer, saving) => `${offer.title} applied · You save ${rupees(saving)}`
};

class CartOfferError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Body-level entry point. serviceIds: the cart. clientId: optional (limits
// and first-visit checks only run for a known customer).
const evaluateCart = async ({ unitId, serviceIds, clientId, now = new Date() }) => {
  if (!mongoose.isValidObjectId(unitId)) throw new CartOfferError(400, 'Valid unitId is required');
  const wanted = Array.isArray(serviceIds) ? [...new Set(serviceIds.map(String))] : [];
  if (wanted.length > 20 || !wanted.every(id => mongoose.isValidObjectId(id))) throw new CartOfferError(400, 'Invalid serviceIds');

  const unit = await Unit.findOne({ _id: unitId, status: 'Active' }).select('appServiceGroupId serviceGroupId').lean();
  if (!unit) throw new CartOfferError(404, 'Salon not found');
  const groupId = unit.appServiceGroupId || unit.serviceGroupId;

  // Cart lines in the customer's order, priced from the menu
  const found = wanted.length && groupId
    ? await Service.find({ _id: { $in: wanted }, groupId, isActive: { $ne: false } }).select('name price img service_time').lean()
    : [];
  const byId = new Map(found.map(s => [String(s._id), s]));
  const cart = wanted.map(id => byId.get(id)).filter(Boolean);
  const subtotal = round2(cart.reduce((sum, s) => sum + (Number(s.price) || 0), 0));

  const empty = { subtotal, discount: 0, total: subtotal, applied: null, claimable: [], next: null, offers: [] };
  const offers = await offersForUnit(unit, now);
  if (!offers.length) return empty;

  const client = clientId && mongoose.isValidObjectId(clientId)
    ? await Client.findById(clientId).select('phoneNumber').lean()
    : null;

  const rewardIds = [...new Set(offers.map(o => o.reward.serviceId && String(o.reward.serviceId)).filter(Boolean))];
  const rewardServices = new Map((await Service.find({ _id: { $in: rewardIds }, groupId, isActive: { $ne: false } })
    .select('name price img service_time').lean()).map(s => [String(s._id), s]));

  const rows = [];
  for (const offer of offers) {
    const needsService = offer.reward.type !== 'CART_DISCOUNT';
    const rewardService = needsService ? rewardServices.get(String(offer.reward.serviceId)) : null;
    // Reward service gone from the menu: nothing to give
    if (needsService && !rewardService) continue;
    const blocked = await blockedFor(offer, client);
    if (blocked) continue;
    const progress = progressOf(offer, cart);
    rows.push({
      offer, rewardService, progress,
      reward: progress.met ? rewardFor(offer, cart, rewardService) : null,
      potential: potentialSaving(offer, cart, rewardService)
    });
  }

  // Best met offer with its reward in the cart
  const appliedRow = rows.filter(r => r.reward)
    .sort((a, b) => b.reward.saving - a.reward.saving || (b.offer.priority || 0) - (a.offer.priority || 0))[0] || null;
  const appliedSaving = appliedRow?.reward.saving || 0;

  const claimable = rows
    .filter(r => r.progress.met && !r.reward && r.rewardService && r.potential > appliedSaving)
    .map(r => ({
      offerId: String(r.offer._id),
      title: r.offer.title,
      rewardType: r.offer.reward.type,
      service: toServiceCard(r.rewardService),
      saving: round2(r.potential),
      message: messageFor.claimable(r.offer, r.rewardService)
    }));

  const nextRow = rows
    .filter(r => !r.progress.met && r.potential > appliedSaving)
    .sort((a, b) => (a.progress.remaining / a.progress.target) - (b.progress.remaining / b.progress.target) || (b.offer.priority || 0) - (a.offer.priority || 0))[0] || null;

  const next = nextRow ? {
    offerId: String(nextRow.offer._id),
    title: nextRow.offer.title,
    description: nextRow.offer.description || null,
    goal: nextRow.offer.trigger.type,
    target: nextRow.progress.target,
    current: nextRow.progress.current,
    remaining: nextRow.progress.remaining,
    progress: Math.min(nextRow.progress.current / nextRow.progress.target, 1),
    message: messageFor.next(nextRow.offer, nextRow.progress),
    suggestions: await suggestionsFor(nextRow.offer, cart, nextRow.progress.remaining, groupId, unitId)
  } : null;

  const applied = appliedRow ? {
    offerId: String(appliedRow.offer._id),
    title: appliedRow.offer.title,
    rewardType: appliedRow.offer.reward.type,
    saving: appliedRow.reward.saving,
    lines: appliedRow.reward.lines,
    message: messageFor.applied(appliedRow.offer, appliedRow.reward.saving)
  } : null;

  return {
    subtotal,
    discount: appliedSaving,
    total: round2(subtotal - appliedSaving),
    applied,
    claimable,
    next,
    offers: rows.map(r => ({
      offerId: String(r.offer._id),
      title: r.offer.title,
      description: r.offer.description || null,
      goal: goalLabel(r.offer),
      rewardService: r.rewardService ? toServiceCard(r.rewardService) : null
    }))
  };
};

module.exports = { evaluateCart, CartOfferError, offersForUnit, goalLabel, isLive, liveUse };
