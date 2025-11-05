const Account = require('../models/Account');

class AccountController {
  async createAccount(req, res) {
    try {
      const account = new Account(req.body);
      await account.save();
      
      res.status(200).json({
        success: true,
        message: "Account created successfully",
        statusCode: 201,
        data: account
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
 
  async searchAccount(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 }
      };
      const accounts = await Account.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: accounts });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateAccount(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }
      
      const account = await Account.findByIdAndUpdate(_id, req.body, { new: true });
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json({ statusCode: 200, data: account });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteAccount(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Account ID is required' });
      }
      const account = await Account.findByIdAndRemove(_id);
      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }
      res.json({ statusCode: 200, message: 'Account deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AccountController();