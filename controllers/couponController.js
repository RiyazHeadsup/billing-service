const Coupon = require('../models/Coupon');
const ChildService = require('../models/ChildService');

class CouponController {
  async createCoupon(req, res) {
    try {
      const coupon = new Coupon(req.body);
      await coupon.save();
      res.status(200).json({
        success: true,
        message: "coupon created successfully",
        statusCode: 201,
        data: coupon
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchCoupon(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: req.body.populate || [
          { path: 'specificServices', select: 'serviceName' },
          { path: 'specificProducts', select: 'productName' },
          { path: 'unitIds', select: 'unitName unitCode' },
          { path: 'createdBy', select: 'name email' }
        ]
      };
      const coupons = await Coupon.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: coupons });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateCoupon(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Coupon ID is required' });
      }
      
      const coupon = await Coupon.findByIdAndUpdate(_id, req.body, { new: true });
      if (!coupon) {
        return res.status(404).json({ error: 'Coupon not found' });
      }
      res.json({ statusCode: 200, data: coupon });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteCoupon(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Coupon ID is required' });
      }
      const coupon = await Coupon.findByIdAndRemove(_id);
      if (!coupon) {
        return res.status(404).json({ error: 'Coupon not found' });
      }
      res.json({ statusCode: 200, message: 'Coupon deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async validateCoupon(req, res) {
    try {
      const { code, unitId, serviceIds, productIds, purchaseAmount } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: 'Coupon code is required' });
      }

      const currentTimestamp = Date.now();
      const coupon = await Coupon.findOne({
        code: code.toUpperCase(),
        isActive: true,
        // startTimestamp: { $lte: currentTimestamp },
        // endTimestamp: { $gte: currentTimestamp }
      });

      if (!coupon) {
        return res.status(404).json({ error: 'Invalid or expired coupon' });
      }

      if (coupon.maxUsageLimit && coupon.usedCount >= coupon.maxUsageLimit) {
        return res.status(400).json({ error: 'Coupon usage limit exceeded' });
      }

      if (coupon.unitIds.length > 0 && !coupon.unitIds.includes(unitId)) {
        return res.status(400).json({ error: 'Coupon not applicable for this unit' });
      }

      if (coupon.minPurchaseAmount > 0 && purchaseAmount < coupon.minPurchaseAmount) {
        return res.status(400).json({ 
          error: `Minimum purchase amount of ${coupon.minPurchaseAmount} required` 
        });
      }

      if (coupon.applicableOn === 'service' && coupon.specificServices.length > 0) {
        const hasValidService = serviceIds?.some(id => 
          coupon.specificServices.includes(id)
        );
        if (!hasValidService) {
          return res.status(400).json({ error: 'Coupon not applicable for selected services' });
        }
      }

      if (coupon.applicableOn === 'product' && coupon.specificProducts.length > 0) {
        const hasValidProduct = productIds?.some(id => 
          coupon.specificProducts.includes(id)
        );
        if (!hasValidProduct) {
          return res.status(400).json({ error: 'Coupon not applicable for selected products' });
        }
      }

      let discountAmount = 0;
      if (coupon.discountType === 'percentage') {
        discountAmount = (purchaseAmount * coupon.discountValue) / 100;
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
          discountAmount = coupon.maxDiscountAmount;
        }
      } else {
        discountAmount = coupon.discountValue;
      }

      res.json({
        statusCode: 200,
        data: {
          coupon,
          discountAmount,
          finalAmount: purchaseAmount - discountAmount
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async applyCoupon(req, res) {
    try {
      const { couponId, userId } = req.body;
      
      if (!couponId) {
        return res.status(400).json({ error: 'Coupon ID is required' });
      }

      const coupon = await Coupon.findById(couponId);
      if (!coupon) {
        return res.status(404).json({ error: 'Coupon not found' });
      }

      coupon.usedCount += 1;
      await coupon.save();

      res.json({
        statusCode: 200,
        message: 'Coupon applied successfully',
        data: coupon
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new CouponController();