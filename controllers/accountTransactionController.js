const AccountTransaction = require('../models/AccountTransaction');
const Account = require('../models/Account');

async function createAccountTransactionInternal(accountId, transactionType, amount, description, referenceType, referenceId, paymentMethod, userId, unitId, createdBy, notes = null) {
  try {
    // Find the account first to get current balance
    let account = await Account.findById(accountId);
    
    if (!account) {
      console.error(`Account not found for accountId ${accountId}`);
      return { success: false, error: 'Account not found' };
    }

    const balanceBefore = account.balance;
    let balanceAfter;

    // Calculate new balance based on transaction type
    if (transactionType === 'credit') {
      balanceAfter = balanceBefore + amount;
      account.balance = balanceAfter;
      account.totalIn += amount;
    } else if (transactionType === 'debit') {
      balanceAfter = balanceBefore - amount;
      account.balance = balanceAfter;
      account.totalOut += amount;
    } else {
      return { success: false, error: 'Invalid transaction type' };
    }

    // Create transaction record
    const transactionData = {
      accountId: accountId,
      transactionType: transactionType,
      amount: amount,
      balanceAfter: balanceAfter,
      description: description,
      referenceType: referenceType,
      referenceId: referenceId,
      paymentMethod: paymentMethod,
      userId: userId,
      unitId: unitId,
      transactionDate: Date.now(),
      createdBy: typeof createdBy === 'object' && createdBy.id ? createdBy.id : createdBy,
      notes: notes
    };

    const accountTransaction = new AccountTransaction(transactionData);
    
    // Save both account and transaction
    await Promise.all([
      account.save(),
      accountTransaction.save()
    ]);

    console.log(`${transactionType} transaction of ${amount} created for account ${accountId}. Balance: ${balanceBefore} -> ${balanceAfter}`);
    
    return {
      success: true,
      transaction: accountTransaction,
      account: account,
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter
    };
  } catch (error) {
    console.error('Error creating account transaction:', error);
    return { success: false, error: error.message };
  }
}

class AccountTransactionController {
  async createAccountTransaction(req, res) {
    try {
      const accountTransaction = new AccountTransaction(req.body);
      await accountTransaction.save();

      // Update account balance
      const { accountId, transactionType, amount } = req.body;
      let account = await Account.findById(accountId);
      
      if (account) {
        // Update balance based on transaction type
        if (transactionType === 'credit') {
          account.balance += amount;
          account.totalIn += amount;
        } else if (transactionType === 'debit') {
          account.balance -= amount;
          account.totalOut += amount;
        }
        
        // Update balanceAfter in the transaction
        accountTransaction.balanceAfter = account.balance;
        await accountTransaction.save();
        
        // Save updated account
        await account.save();
      } else {
        console.error(`Account not found for accountId ${accountId}`);
      }
      
      res.status(200).json({
        success: true,
        message: "Account transaction created successfully",
        statusCode: 201,
        data: accountTransaction
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchAccountTransaction(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { transactionDate: -1 }
      };
      const accountTransactions = await AccountTransaction.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: accountTransactions });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateAccountTransaction(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Account Transaction ID is required' });
      }
      
      const accountTransaction = await AccountTransaction.findByIdAndUpdate(_id, req.body, { new: true });
      if (!accountTransaction) {
        return res.status(404).json({ error: 'Account transaction not found' });
      }
      res.json({ statusCode: 200, data: accountTransaction });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteAccountTransaction(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Account Transaction ID is required' });
      }
      const accountTransaction = await AccountTransaction.findByIdAndRemove(_id);
      if (!accountTransaction) {
        return res.status(404).json({ error: 'Account transaction not found' });
      }
      res.json({ statusCode: 200, message: 'Account transaction deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = {
  controller: new AccountTransactionController(),
  createAccountTransactionInternal
};