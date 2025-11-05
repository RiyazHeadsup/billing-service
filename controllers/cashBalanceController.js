const CashBalance = require('../models/CashBalance');
const User = require('../models/User');
const Unit = require('../models/Unit');

class CashBalanceController {
  async createCashBalance(req, res) {
    try {
      const cashBalance = new CashBalance(req.body);
      await cashBalance.save();
      res.status(200).json({
        success: true,
        message: "cash balance created successfully",
        statusCode: 201,
        data: cashBalance
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchCashBalance(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: req.body.populate || [
          { path: 'unitId', select: 'name' },
          { path: 'recordedBy', select: 'name' }
        ]
      };
      const cashBalances = await CashBalance.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: cashBalances });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateCashBalance(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Cash balance ID is required' });
      }
      
      const cashBalance = await CashBalance.findByIdAndUpdate(_id, req.body, { new: true });
      if (!cashBalance) {
        return res.status(404).json({ error: 'Cash balance not found' });
      }
      res.json({ statusCode: 200, data: cashBalance });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteCashBalance(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Cash balance ID is required' });
      }
      const cashBalance = await CashBalance.findByIdAndRemove(_id);
      if (!cashBalance) {
        return res.status(404).json({ error: 'Cash balance not found' });
      }
      res.json({ statusCode: 200, message: 'Cash balance deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new CashBalanceController();