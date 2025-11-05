const Wallet = require('../models/Wallet');
const Client = require('../models/Client');

class WalletController {
  async createWallet(req, res) {
    try {
      const wallet = new Wallet(req.body);
      await wallet.save();
      res.status(200).json({
        success: true,
        message: "wallet created successfully",
        statusCode: 201,
        data: wallet
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchWallet(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: req.body.populate || [
          { path: 'clientId', select: 'name phoneNumber' }
        ]
      };
      const wallets = await Wallet.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: wallets });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateWallet(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Wallet ID is required' });
      }
      
      const wallet = await Wallet.findByIdAndUpdate(_id, req.body, { new: true });
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }
      res.json({ statusCode: 200, data: wallet });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteWallet(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Wallet ID is required' });
      }
      const wallet = await Wallet.findByIdAndRemove(_id);
      if (!wallet) {
        return res.status(404).json({ error: 'Wallet not found' });
      }
      res.json({ statusCode: 200, message: 'Wallet deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  getHealth(req, res) {
    res.json({ status: 'healthy', service: 'billing-service' });
  }
}

module.exports = new WalletController();