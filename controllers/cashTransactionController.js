const CashTransaction = require('../models/CashTransaction');
const CashBalance = require('../models/CashBalance');
const Account = require('../models/Account');
const { createAccountTransactionInternal } = require('./accountTransactionController');

class CashTransactionController {
  async createCashTransaction(req, res) {
    try {
      const transactionData = { ...req.body };
      
      // Only include inAccountTo if it's provided in the request
      if (!req.body.inAccountTo) {
        delete transactionData.inAccountTo;
      }
      
      const cashTransaction = new CashTransaction(transactionData);
      await cashTransaction.save();

      // Update cash balance
      const { unitId, transactionType } = req.body;
      let cashBalance = await CashBalance.findOne({ unitId });
      
      if (cashBalance) {
        // Update existing balance based on transaction type
        if (transactionType === 'in') {
          cashBalance.note500 += req.body.note500 || 0;
          cashBalance.note200 += req.body.note200 || 0;
          cashBalance.note100 += req.body.note100 || 0;
          cashBalance.note50 += req.body.note50 || 0;
          cashBalance.note20 += req.body.note20 || 0;
          cashBalance.note10 += req.body.note10 || 0;
          cashBalance.coin10 += req.body.coin10 || 0;
          cashBalance.coin5 += req.body.coin5 || 0;
          cashBalance.coin2 += req.body.coin2 || 0;
          cashBalance.coin1 += req.body.coin1 || 0;
          cashBalance.totalAmount += req.body.totalAmount || 0;
        } else if (transactionType === 'out') {
          cashBalance.note500 -= req.body.note500 || 0;
          cashBalance.note200 -= req.body.note200 || 0;
          cashBalance.note100 -= req.body.note100 || 0;
          cashBalance.note50 -= req.body.note50 || 0;
          cashBalance.note20 -= req.body.note20 || 0;
          cashBalance.note10 -= req.body.note10 || 0;
          cashBalance.coin10 -= req.body.coin10 || 0;
          cashBalance.coin5 -= req.body.coin5 || 0;
          cashBalance.coin2 -= req.body.coin2 || 0;
          cashBalance.coin1 -= req.body.coin1 || 0;
          cashBalance.totalAmount -= req.body.totalAmount || 0;
        }
        await cashBalance.save();
      } else {
        // Create new cash balance if it doesn't exist
        const newCashBalance = new CashBalance({
          ...req.body,
          balanceType: 'current',
          balanceDate: new Date()
        });
        await newCashBalance.save();
      }

      // Create account transaction if inAccountTo is provided
      if (req.body.inAccountTo) {
        try {
          // Find account by userId (inAccountTo)
          const account = await Account.findOne({ userId: req.body.inAccountTo });
          
          if (account) {
            // Determine transaction type for account (opposite of cash transaction)
            // Cash "in" = money from account to cash = account "debit"
            // Cash "out" = money from cash to account = account "credit"
            const accountTransactionType = transactionType === 'in' ? 'debit' : 'credit';
            
            const accountTransactionResult = await createAccountTransactionInternal(
              account._id,
              accountTransactionType,
              req.body.totalAmount,
              `Cash transaction: ${req.body.description || req.body.category}`,
              'transfer',
              cashTransaction._id,
              'cash',
              req.body.inAccountTo,
              req.body.unitId,
              req.body.recordedBy,
              `Cash ${transactionType} transaction reference: ${cashTransaction._id}`
            );

            if (accountTransactionResult.success) {
              console.log(`Account transaction created for user ${req.body.inAccountTo}. Amount: ${req.body.totalAmount}, Type: ${accountTransactionType}`);
            } else {
              console.error(`Failed to create account transaction: ${accountTransactionResult.error}`);
            }
          } else {
            console.log(`No account found for user ${req.body.inAccountTo}`);
          }
        } catch (accountError) {
          console.error('Error creating account transaction:', accountError);
          // Don't fail the cash transaction if account transaction fails
        }
      }

      res.status(200).json({
        success: true,
        message: "cash transaction created successfully",
        statusCode: 201,
        data: cashTransaction
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchCashTransaction(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: req.body.populate || [
          { path: 'unitId', select: 'name' },
          { path: 'recordedBy', select: 'name' },
          { path: 'approvedBy', select: 'name' },
          { path: 'orderId', select: 'orderNumber' },
          { path: 'customerId', select: 'name' },
          { path: 'supplierId', select: 'name' },
          { path: 'inAccountTo', select: 'name'},
        ]
      };
      const cashTransactions = await CashTransaction.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: cashTransactions });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateCashTransaction(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Cash transaction ID is required' });
      }
      
      const updateData = { ...req.body };
      
      // Only include inAccountTo if it's provided in the request
      if (!req.body.inAccountTo) {
        delete updateData.inAccountTo;
      }
      
      const cashTransaction = await CashTransaction.findByIdAndUpdate(_id, updateData, { new: true });
      if (!cashTransaction) {
        return res.status(404).json({ error: 'Cash transaction not found' });
      }
      res.json({ statusCode: 200, data: cashTransaction });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteCashTransaction(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Cash transaction ID is required' });
      }
      const cashTransaction = await CashTransaction.findByIdAndRemove(_id);
      if (!cashTransaction) {
        return res.status(404).json({ error: 'Cash transaction not found' });
      }
      res.json({ statusCode: 200, message: 'Cash transaction deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new CashTransactionController();