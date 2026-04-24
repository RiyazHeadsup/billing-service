const DayClosing = require('../models/DayClosing');
const Bill = require('../models/Bill');
const CashBalance = require('../models/CashBalance');
const CashTransaction = require('../models/CashTransaction');

class DayClosingController {

  // POST /addDayClosing
  async addDayClosing(req, res) {
    try {
      const closing = new DayClosing(req.body);
      await closing.save();
      res.status(200).json({ success: true, statusCode: 201, message: 'Day closing created', data: closing });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ statusCode: 400, error: 'Day closing already exists for this date and unit' });
      }
      res.status(400).json({ statusCode: 400, error: error.message });
    }
  }

  // POST /searchDayClosing
  async searchDayClosing(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { dateTimestamp: -1 },
        populate: req.body.populate || [
          { path: 'closedBy', select: 'name' },
          { path: 'reviewedBy', select: 'name' },
        ]
      };
      const result = await DayClosing.paginate(req.body.search || {}, options);
      res.json({ statusCode: 200, data: result });
    } catch (error) {
      res.status(500).json({ statusCode: 500, error: error.message });
    }
  }

  // POST /updateDayClosing
  async updateDayClosing(req, res) {
    try {
      const { _id, ...updateData } = req.body;
      const closing = await DayClosing.findByIdAndUpdate(_id, updateData, { new: true });
      if (!closing) return res.status(404).json({ statusCode: 404, error: 'Not found' });
      res.json({ statusCode: 200, message: 'Day closing updated', data: closing });
    } catch (error) {
      res.status(400).json({ statusCode: 400, error: error.message });
    }
  }

  // POST /deleteDayClosing
  async deleteDayClosing(req, res) {
    try {
      await DayClosing.findByIdAndRemove(req.body._id);
      res.json({ statusCode: 200, message: 'Day closing deleted' });
    } catch (error) {
      res.status(500).json({ statusCode: 500, error: error.message });
    }
  }

  // POST /generateDayClosing - Auto-generate from today's data
  async generateDayClosing(req, res) {
    try {
      const { unitId, closedBy, closedByName, remarks, actualCash, actualCard, actualUpi, actualWallet } = req.body;
      if (!unitId) return res.status(400).json({ statusCode: 400, error: 'unitId is required' });

      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // Fetch today's bills for this unit
      const bills = await Bill.find({
        unitId,
        createdAt: { $gte: new Date(dayStart), $lte: new Date(dayEnd) },
        status: { $ne: 'cancelled' }
      });

      // Calculate system amounts by payment method
      let sysCash = 0, sysCard = 0, sysUpi = 0, sysWallet = 0, changeReturned = 0;
      let totalRevenue = 0, serviceRevenue = 0, productRevenue = 0, membershipRevenue = 0, totalDiscount = 0;

      bills.forEach(bill => {
        const methods = bill.payment?.methods || {};
        sysCash += methods.cash || 0;
        sysCard += methods.card || 0;
        sysUpi += methods.upi || 0;
        sysWallet += methods.wallet || 0;
        changeReturned += bill.changeReturned || 0;

        const totals = bill.calculations?.totals || {};
        totalRevenue += totals.grandTotal || 0;
        totalDiscount += totals.totalDiscount || totals.totalItemDiscount || 0;

        const items = bill.calculations?.items || {};
        serviceRevenue += items.services?.finalTotal || 0;
        productRevenue += items.products?.finalTotal || 0;
        membershipRevenue += items.memberships?.finalTotal || 0;
      });

      // Fetch cash balance
      const cashBalance = await CashBalance.findOne({ unitId }).sort({ updatedAt: -1 });
      const closingBalance = cashBalance?.totalAmount || 0;

      // Fetch today's cash transactions
      const cashTxs = await CashTransaction.find({
        unitId,
        createdAt: { $gte: new Date(dayStart), $lte: new Date(dayEnd) }
      });

      let cashIn = 0, cashOut = 0;
      const expenseItems = [];

      cashTxs.forEach(tx => {
        if (tx.transactionType === 'in') {
          cashIn += tx.totalAmount || 0;
        } else {
          cashOut += tx.totalAmount || 0;
          if (tx.category && tx.category !== 'sale' && tx.category !== 'refund') {
            expenseItems.push({
              category: tx.category,
              description: tx.description || '',
              amount: tx.totalAmount || 0,
            });
          }
        }
      });

      const openingBalance = closingBalance - cashIn + cashOut;
      const totalExpenses = expenseItems.reduce((s, e) => s + e.amount, 0);

      // Actual amounts from user input (0 if not provided)
      const actCash = actualCash || 0;
      const actCard = actualCard || 0;
      const actUpi = actualUpi || 0;
      const actWallet = actualWallet || 0;

      const totalSystemAmount = sysCash + sysCard + sysUpi + sysWallet;
      const totalActualAmount = actCash + actCard + actUpi + actWallet;

      const updateData = {
        cash: {
          systemAmount: sysCash,
          actualAmount: actCash,
          difference: actCash - sysCash,
          openingBalance,
          closingBalance,
          cashIn,
          cashOut,
          changeReturned,
        },
        card: { systemAmount: sysCard, actualAmount: actCard, difference: actCard - sysCard },
        upi: { systemAmount: sysUpi, actualAmount: actUpi, difference: actUpi - sysUpi },
        wallet: { systemAmount: sysWallet, actualAmount: actWallet, difference: actWallet - sysWallet },
        totalSystemAmount,
        totalActualAmount,
        totalDifference: totalActualAmount - totalSystemAmount,
        sales: { totalBills: bills.length, totalRevenue, serviceRevenue, productRevenue, membershipRevenue, totalDiscount },
        expenses: { totalExpenses, items: expenseItems },
        netAmount: totalRevenue - totalExpenses,
        closedBy,
        closedByName,
        remarks,
        status: 'closed',
      };

      // Check if an 'open' record exists for today - update it instead of creating new
      const existing = await DayClosing.findOne({ unitId, dateTimestamp: dayStart });
      let closing;
      if (existing) {
        // Preserve opening balance from the 'open' record
        updateData.cash.openingBalance = existing.cash?.openingBalance || openingBalance;
        closing = await DayClosing.findByIdAndUpdate(existing._id, updateData, { new: true });
      } else {
        closing = new DayClosing({ date: dateStr, dateTimestamp: dayStart, unitId, ...updateData });
        await closing.save();
      }

      res.status(200).json({ success: true, statusCode: 201, message: 'Day closed successfully', data: closing });
    } catch (error) {
      res.status(500).json({ statusCode: 500, error: error.message });
    }
  }

  getHealth(req, res) {
    res.json({ status: 'healthy', service: 'day-closing' });
  }
}

module.exports = new DayClosingController();
