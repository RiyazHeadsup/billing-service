const WalletTransaction = require('../models/WalletTransaction');
const Wallet = require('../models/Wallet');

class WalletTransactionController {
  async createTransaction(req, res) {
    try {
      const { walletId, clientId, type, amount, description, category, reference, createdBy, notes } = req.body;

      if (!walletId || !clientId || !type || !amount || !description || !category || !createdBy) {
        return res.status(400).json({ 
          success: false,
          error: 'Required fields: walletId, clientId, type, amount, description, category, createdBy' 
        });
      }

      const wallet = await Wallet.findById(walletId);
      if (!wallet) {
        return res.status(404).json({ 
          success: false,
          error: 'Wallet not found' 
        });
      }

      if (wallet.isFrozen) {
        return res.status(400).json({ 
          success: false,
          error: 'Wallet is frozen. Cannot process transaction.' 
        });
      }

      const balanceBefore = wallet.balance;
      let balanceAfter;

      if (type === 'credit') {
        balanceAfter = balanceBefore + amount;
        wallet.balance = balanceAfter;
        wallet.totalCredits += amount;
      } else if (type === 'debit') {
        if (balanceBefore < amount) {
          return res.status(400).json({ 
            success: false,
            error: `Insufficient balance. Available: ${balanceBefore}, Required: ${amount}` 
          });
        }
        balanceAfter = balanceBefore - amount;
        wallet.balance = balanceAfter;
        wallet.totalDebits += amount;
      } else {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid transaction type. Must be credit or debit' 
        });
      }

      wallet.lastTransactionAt = new Date();

      const transaction = new WalletTransaction({
        walletId,
        clientId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        category,
        reference: reference || {},
        createdBy,
        notes
      });

      await Promise.all([
        transaction.save(),
        wallet.save()
      ]);

      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        statusCode: 201,
        data: transaction
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  }

  async getTransactions(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 20,
        sort: req.body.sort || { createdAt: -1 },
        populate: [
          { path: 'walletId', select: 'clientId balance' },
          { path: 'clientId', select: 'name email phone' },
          { path: 'reference.billId', select: 'billNumber' },
          { path: 'reference.membershipId', select: 'membershipName' }
        ]
      };

      const transactions = await WalletTransaction.paginate(req.body.search || {}, options);
      
      res.json({ 
        success: true,
        statusCode: 200, 
        data: transactions 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        statusCode: 500, 
        error: error.message 
      });
    }
  }

  async getTransactionsByWallet(req, res) {
    try {
      const { walletId, page = 1, limit = 20 } = req.body;
      
      if (!walletId) {
        return res.status(400).json({ 
          success: false,
          error: 'Wallet ID is required' 
        });
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: 'reference.billId', select: 'billNumber' },
          { path: 'reference.membershipId', select: 'membershipName' }
        ]
      };

      const transactions = await WalletTransaction.paginate({ walletId }, options);
      
      res.json({ 
        success: true,
        statusCode: 200, 
        data: transactions 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        statusCode: 500, 
        error: error.message 
      });
    }
  }

  async getTransactionsByClient(req, res) {
    try {
      const { clientId, page = 1, limit = 20, category, type, startDate, endDate } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ 
          success: false,
          error: 'Client ID is required' 
        });
      }

      let searchQuery = { clientId };
      
      if (category) {
        searchQuery.category = category;
      }
      
      if (type) {
        searchQuery.type = type;
      }

      if (startDate && endDate) {
        searchQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: 'walletId', select: 'balance' },
          { path: 'reference.billId', select: 'billNumber' },
          { path: 'reference.membershipId', select: 'membershipName' }
        ]
      };

      const transactions = await WalletTransaction.paginate(searchQuery, options);
      
      res.json({ 
        success: true,
        statusCode: 200, 
        data: transactions 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        statusCode: 500, 
        error: error.message 
      });
    }
  }

  async getTransactionById(req, res) {
    try {
      const { transactionId } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({ 
          success: false,
          error: 'Transaction ID is required' 
        });
      }

      const transaction = await WalletTransaction.findById(transactionId)
        .populate('walletId', 'clientId balance')
        .populate('clientId', 'name email phone')
        .populate('reference.billId', 'billNumber')
        .populate('reference.membershipId', 'membershipName');

      if (!transaction) {
        return res.status(404).json({ 
          success: false,
          error: 'Transaction not found' 
        });
      }

      res.json({ 
        success: true,
        statusCode: 200, 
        data: transaction 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        statusCode: 500, 
        error: error.message 
      });
    }
  }

  async getTransactionByTransactionId(req, res) {
    try {
      const { transactionId } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({ 
          success: false,
          error: 'Transaction ID is required' 
        });
      }

      const transaction = await WalletTransaction.findOne({ transactionId })
        .populate('walletId', 'clientId balance')
        .populate('clientId', 'name email phone')
        .populate('reference.billId', 'billNumber')
        .populate('reference.membershipId', 'membershipName');

      if (!transaction) {
        return res.status(404).json({ 
          success: false,
          error: 'Transaction not found' 
        });
      }

      res.json({ 
        success: true,
        statusCode: 200, 
        data: transaction 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        statusCode: 500, 
        error: error.message 
      });
    }
  }

  async getWalletBalance(req, res) {
    try {
      const { clientId } = req.body;
      
      if (!clientId) {
        return res.status(400).json({ 
          success: false,
          error: 'Client ID is required' 
        });
      }

      const wallet = await Wallet.findOne({ clientId })
        .populate('clientId', 'name email phone');

      if (!wallet) {
        return res.status(404).json({ 
          success: false,
          error: 'Wallet not found' 
        });
      }

      res.json({ 
        success: true,
        statusCode: 200, 
        data: {
          walletId: wallet._id,
          clientId: wallet.clientId,
          balance: wallet.balance,
          totalCredits: wallet.totalCredits,
          totalDebits: wallet.totalDebits,
          lastTransactionAt: wallet.lastTransactionAt,
          isActive: wallet.isActive,
          isFrozen: wallet.isFrozen
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        statusCode: 500, 
        error: error.message 
      });
    }
  }

  async getTransactionStats(req, res) {
    try {
      const { clientId, walletId, startDate, endDate } = req.body;
      
      let matchQuery = {};
      
      if (clientId) {
        matchQuery.clientId = clientId;
      }
      
      if (walletId) {
        matchQuery.walletId = walletId;
      }

      if (startDate && endDate) {
        matchQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const stats = await WalletTransaction.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalTransactions: { $sum: 1 },
            totalCredits: {
              $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] }
            },
            totalDebits: {
              $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] }
            },
            creditCount: {
              $sum: { $cond: [{ $eq: ['$type', 'credit'] }, 1, 0] }
            },
            debitCount: {
              $sum: { $cond: [{ $eq: ['$type', 'debit'] }, 1, 0] }
            },
            avgTransactionAmount: { $avg: '$amount' }
          }
        }
      ]);

      const categoryStats = await WalletTransaction.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      res.json({ 
        success: true,
        statusCode: 200, 
        data: {
          summary: stats.length > 0 ? stats[0] : {
            totalTransactions: 0,
            totalCredits: 0,
            totalDebits: 0,
            creditCount: 0,
            debitCount: 0,
            avgTransactionAmount: 0
          },
          categoryBreakdown: categoryStats
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        statusCode: 500, 
        error: error.message 
      });
    }
  }
}

module.exports = new WalletTransactionController();