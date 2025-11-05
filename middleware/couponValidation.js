const validateCouponCreation = (req, res, next) => {
  const { code, name, discountType, discountValue, applicableOn, startTimestamp, endTimestamp, createdBy } = req.body;
  
  const errors = [];

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    errors.push('Code is required and must be a non-empty string');
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Name is required and must be a non-empty string');
  }

  if (!discountType || !['percentage', 'fixed'].includes(discountType)) {
    errors.push('Discount type must be either "percentage" or "fixed"');
  }

  if (!discountValue || typeof discountValue !== 'number' || discountValue < 0) {
    errors.push('Discount value is required and must be a positive number');
  }

  if (discountType === 'percentage' && discountValue > 100) {
    errors.push('Percentage discount cannot exceed 100%');
  }

  if (!applicableOn || !['service', 'product', 'both'].includes(applicableOn)) {
    errors.push('Applicable on must be "service", "product", or "both"');
  }

  if (!startTimestamp || typeof startTimestamp !== 'number' || startTimestamp < 0) {
    errors.push('Valid start timestamp is required');
  }

  if (!endTimestamp || typeof endTimestamp !== 'number' || endTimestamp < 0) {
    errors.push('Valid end timestamp is required');
  }

  if (startTimestamp && endTimestamp && startTimestamp >= endTimestamp) {
    errors.push('End timestamp must be after start timestamp');
  }

  if (!createdBy || typeof createdBy !== 'string') {
    errors.push('Created by is required');
  }

  if (req.body.maxDiscountAmount && (typeof req.body.maxDiscountAmount !== 'number' || req.body.maxDiscountAmount < 0)) {
    errors.push('Max discount amount must be a positive number');
  }

  if (req.body.minPurchaseAmount && (typeof req.body.minPurchaseAmount !== 'number' || req.body.minPurchaseAmount < 0)) {
    errors.push('Min purchase amount must be a positive number');
  }

  if (req.body.maxUsageLimit && (typeof req.body.maxUsageLimit !== 'number' || req.body.maxUsageLimit < 1)) {
    errors.push('Max usage limit must be a positive integer');
  }

  if (req.body.perUserLimit && (typeof req.body.perUserLimit !== 'number' || req.body.perUserLimit < 1)) {
    errors.push('Per user limit must be a positive integer');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

const validateCouponUpdate = (req, res, next) => {
  const { _id } = req.body;
  
  if (!_id || typeof _id !== 'string') {
    return res.status(400).json({
      error: 'Coupon ID is required'
    });
  }

  const errors = [];

  if (req.body.discountType && !['percentage', 'fixed'].includes(req.body.discountType)) {
    errors.push('Discount type must be either "percentage" or "fixed"');
  }

  if (req.body.discountValue !== undefined && (typeof req.body.discountValue !== 'number' || req.body.discountValue < 0)) {
    errors.push('Discount value must be a positive number');
  }

  if (req.body.discountType === 'percentage' && req.body.discountValue > 100) {
    errors.push('Percentage discount cannot exceed 100%');
  }

  if (req.body.applicableOn && !['service', 'product', 'both'].includes(req.body.applicableOn)) {
    errors.push('Applicable on must be "service", "product", or "both"');
  }

  if (req.body.startTimestamp !== undefined && (typeof req.body.startTimestamp !== 'number' || req.body.startTimestamp < 0)) {
    errors.push('Start timestamp must be a valid number');
  }

  if (req.body.endTimestamp !== undefined && (typeof req.body.endTimestamp !== 'number' || req.body.endTimestamp < 0)) {
    errors.push('End timestamp must be a valid number');
  }

  if (req.body.startTimestamp && req.body.endTimestamp && req.body.startTimestamp >= req.body.endTimestamp) {
    errors.push('End timestamp must be after start timestamp');
  }

  if (req.body.maxDiscountAmount !== undefined && (typeof req.body.maxDiscountAmount !== 'number' || req.body.maxDiscountAmount < 0)) {
    errors.push('Max discount amount must be a positive number');
  }

  if (req.body.minPurchaseAmount !== undefined && (typeof req.body.minPurchaseAmount !== 'number' || req.body.minPurchaseAmount < 0)) {
    errors.push('Min purchase amount must be a positive number');
  }

  if (req.body.maxUsageLimit !== undefined && (typeof req.body.maxUsageLimit !== 'number' || req.body.maxUsageLimit < 1)) {
    errors.push('Max usage limit must be a positive integer');
  }

  if (req.body.perUserLimit !== undefined && (typeof req.body.perUserLimit !== 'number' || req.body.perUserLimit < 1)) {
    errors.push('Per user limit must be a positive integer');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

const validateCouponValidation = (req, res, next) => {
  const { code, purchaseAmount } = req.body;
  
  const errors = [];

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    errors.push('Coupon code is required');
  }

  if (!purchaseAmount || typeof purchaseAmount !== 'number' || purchaseAmount < 0) {
    errors.push('Purchase amount is required and must be a positive number');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors
    });
  }

  next();
};

module.exports = {
  validateCouponCreation,
  validateCouponUpdate,
  validateCouponValidation
};