const Bill = require('../models/Bill');
const ClientMembership = require('../models/ClientMembership');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');
const Incentive = require('../models/Incentive');
const dashboardService = require('../services/dashboardService');

async function createClientMemberships(newMemberships, clientId, createdBy) {
  try {
    for (const membership of newMemberships) {
      if (membership.type === 'value_added') {
        // For value_added memberships, add to user's wallet instead of creating membership
        await addToUserWallet(clientId, membership.benefits.valueAddedAmount, membership, createdBy);
      } else {
        // For other membership types (fix_discount, service_discount), create ClientMembership
        const startDate = new Date();
        let endDate = new Date();
        
        if (membership.duration.unit === 'days') {
          endDate.setDate(startDate.getDate() + membership.duration.value);
        } else if (membership.duration.unit === 'months') {
          endDate.setMonth(startDate.getMonth() + membership.duration.value);
        } else if (membership.duration.unit === 'years') {
          endDate.setFullYear(startDate.getFullYear() + membership.duration.value);
        }

        const clientMembershipData = {
          clientId: clientId,
          membershipId: membership.membershipId || membership._id,
          membershipName: membership.name,
          membershipType: membership.type,
          description: membership.description,
          purchaseAmount: membership.pricing.purchaseAmount,
          startDate: startDate,
          endDate: endDate,
          isActive: true,
          status: 'active',
          benefits: {
            valueAddedAmount: membership.benefits.valueAddedAmount,
            fixDiscountPercentage: membership.benefits.fixDiscountPercentage,
            serviceDiscounts: membership.benefits.serviceDiscounts,
            excludedServices: membership.benefits.excludedServices
          },
          duration: membership.duration,
          createdBy: createdBy
        };

        const clientMembership = new ClientMembership(clientMembershipData);
        await clientMembership.save();
      }
    }
  } catch (error) {
    console.error('Error creating client memberships:', error);
  }
}

async function addToUserWallet(clientId, valueAddedAmount, membership, createdBy) {
  try {
    // Find existing wallet (every client should have one)
    let wallet = await Wallet.findOne({ clientId: clientId });
    
    if (!wallet) {
      console.error(`Wallet not found for client ${clientId}`);
      return;
    }

    if (wallet.isFrozen) {
      console.error(`Wallet is frozen for client ${clientId}`);
      return;
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + valueAddedAmount;

    // Update wallet balance and totals
    wallet.balance = balanceAfter;
    wallet.totalCredits += valueAddedAmount;
    wallet.lastTransactionAt = new Date();
    
    // Create separate transaction record
    const transaction = new WalletTransaction({
      walletId: wallet._id,
      clientId: clientId,
      type: 'credit',
      amount: valueAddedAmount,
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      description: `Value added from membership: ${membership.name}`,
      category: 'membership_credit',
      reference: {
        membershipId: membership._id,
        membershipName: membership.name
      },
      createdBy: typeof createdBy === 'object' && createdBy.id ? createdBy.id : createdBy
    });
    
    await Promise.all([
      wallet.save(),
      transaction.save()
    ]);
    
    console.log(`Added ${valueAddedAmount} to wallet for client ${clientId} from membership ${membership.name}`);
  } catch (error) {
    console.error('Error adding to user wallet:', error);
  }
}

async function deductFromUserWallet(clientId, walletAmount, bill, createdBy) {
  try {
    // Find existing wallet
    let wallet = await Wallet.findOne({ clientId: clientId });
    
    if (!wallet) {
      console.error(`Wallet not found for client ${clientId}`);
      return;
    }

    if (wallet.isFrozen) {
      console.error(`Wallet is frozen for client ${clientId}`);
      return;
    }

    // Check if wallet has sufficient balance
    if (wallet.balance < walletAmount) {
      console.error(`Insufficient wallet balance for client ${clientId}. Required: ${walletAmount}, Available: ${wallet.balance}`);
      return;
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - walletAmount;

    // Update wallet balance and totals
    wallet.balance = balanceAfter;
    wallet.totalDebits += walletAmount;
    wallet.lastTransactionAt = new Date();
    
    // Create separate transaction record
    const transaction = new WalletTransaction({
      walletId: wallet._id,
      clientId: clientId,
      type: 'debit',
      amount: walletAmount,
      balanceBefore: balanceBefore,
      balanceAfter: balanceAfter,
      description: `Payment for bill: ${bill.billNumber}`,
      category: 'bill_payment',
      reference: {
        billNumber: bill.billNumber,
        billId: bill._id
      },
      createdBy: typeof createdBy === 'object' && createdBy.id ? createdBy.id : createdBy
    });
    
    await Promise.all([
      wallet.save(),
      transaction.save()
    ]);
    
    console.log(`Deducted ${walletAmount} from wallet for client ${clientId} for bill ${bill.billNumber}`);
  } catch (error) {
    console.error('Error deducting from user wallet:', error);
  }
}

async function createIncentiveRecords(services, billData) {
  try {
    console.log('=== INCENTIVE CREATION START ===');
    console.log(`Bill Number: ${billData.billNumber}`);
    console.log(`Transaction ID: ${billData.transactionId}`);
    console.log(`Total Services: ${services.length}`);
    
    const createdIncentives = [];
    let totalIncentiveAmount = 0;
    
    for (const service of services) {
      if (service.incentive && service.incentive > 0 && service.staff) {
        // Calculate incentive amount based on final price
        const incentivePercentage = service.incentive;
        const finalPrice = service.pricing.finalPrice;
        const incentiveAmount = (finalPrice * incentivePercentage) / 100;
        
        // Create Incentive record
        const incentiveData = {
          billId: billData._id,
          billNumber: billData.billNumber,
          transactionId: billData.transactionId,
          serviceId: service.id,
          serviceName: service.name,
          staffId: service.staff,
          clientId: billData.client.id || billData.client._id,
          finalPrice: finalPrice,
          incentivePercentage: incentivePercentage,
          incentiveAmount: incentiveAmount,
          quantity: service.quantity || 1,
          status: 'pending',
          unitId: billData?.unitId,
          businessDate: new Date(),
          notes: `Auto-generated incentive from bill ${billData.billNumber}`,
          createdBy: billData.createdBy
        };
        
        const incentive = new Incentive(incentiveData);
        await incentive.save();
        
        createdIncentives.push(incentive);
        totalIncentiveAmount += incentiveAmount;
        
        console.log(`--- Incentive Created ---`);
        console.log(`Incentive ID: ${incentive._id}`);
        console.log(`Service: ${service.name} (ID: ${service.id})`);
        console.log(`Staff ID: ${service.staff}`);
        console.log(`Final Price: ₹${finalPrice}`);
        console.log(`Incentive %: ${incentivePercentage}%`);
        console.log(`Incentive Amount: ₹${incentiveAmount.toFixed(2)}`);
        console.log(`Status: ${incentive.status}`);
        console.log(`Quantity: ${service.quantity}`);
      }
    }
    
    console.log(`--- INCENTIVE CREATION SUMMARY ---`);
    console.log(`Total Incentives Created: ${createdIncentives.length}`);
    console.log(`Total Incentive Amount: ₹${totalIncentiveAmount.toFixed(2)}`);
    console.log(`Client: ${billData.client.name} (${billData.client.phoneNumber})`);
    console.log(`Payment Method: ${billData.payment.activePaymentMethods.map(pm => pm.method).join(', ')}`);
    console.log(`Bill Total: ₹${billData.calculations.totals.finalAmount}`);
    console.log('=== INCENTIVE CREATION END ===');
    
    return {
      success: true,
      createdIncentives: createdIncentives,
      totalIncentiveAmount: totalIncentiveAmount,
      billNumber: billData.billNumber,
      transactionId: billData.transactionId
    };
  } catch (error) {
    console.error('Error creating incentive records:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

class BillController {
  async createBill(req, res) {
    try {
      const bill = new Bill(req.body);
      await bill.save();

      if (req.body.newMemberships && req.body.newMemberships.length > 0) {
        await createClientMemberships(req.body.newMemberships, req.body.client.id, req.body.createdBy);
      }

      if (req.body.payment && req.body.payment.methods && req.body.payment.methods.wallet > 0) {
        await deductFromUserWallet(req.body.client.id, req.body.payment.methods.wallet, bill, req.body.createdBy);
      }

      // Create incentive records for services with incentive percentage
      let incentiveResult = null;
      if (req.body.services && req.body.services.length > 0) {
        incentiveResult = await createIncentiveRecords(req.body.services, bill);
        if (incentiveResult.success) {
          console.log(`✅ Incentive records created successfully: ${incentiveResult.createdIncentives.length} incentives totaling ₹${incentiveResult.totalIncentiveAmount.toFixed(2)}`);
        } else {
          console.error('❌ Incentive record creation failed:', incentiveResult.error);
        }
      }

      // Update dashboard with bill data including incentives - only for COMPLETED bills
      if (bill.billStatus === 'COMPLETED') {
        await dashboardService.updateDashboardWithBill(bill, incentiveResult);
      } else {
        console.log(`⏸️  Bill ${bill.billNumber} has status '${bill.billStatus}' - skipping dashboard update`);
      }

      res.status(200).json({
        success: true,
        message: "bill created successfully",
        statusCode: 201,
        data: bill
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchBill(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 }
      };
      const bills = await Bill.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: bills });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateBill(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Bill ID is required' });
      }
      
      const bill = await Bill.findByIdAndUpdate(_id, req.body, { new: true });
      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }
      res.json({ statusCode: 200, data: bill });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteBill(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Bill ID is required' });
      }
      const bill = await Bill.findByIdAndRemove(_id);
      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }
      res.json({ statusCode: 200, message: 'Bill deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getBillByNumber(req, res) {
    try {
      const { billNumber } = req.body;
      if (!billNumber) {
        return res.status(400).json({ error: 'Bill number is required' });
      }
      
      const bill = await Bill.findOne({ billNumber })
        .populate('client.id', 'name email phone')
        .populate('selectedMembership', 'membershipName')
        .populate('services.id', 'serviceName')
        .populate('products.id', 'productName brand')
        .populate('services.staff', 'name')
        .populate('products.staff', 'name')
        .populate('newMemberships.id', 'membershipName')
        .populate('newMemberships.membershipId', 'membershipName type')
        .populate('business.unitId', 'unitName unitCode')
        .populate('createdBy', 'name email');
        
      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }
      res.json({ statusCode: 200, data: bill });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getBillByTransactionId(req, res) {
    try {
      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ error: 'Transaction ID is required' });
      }
      
      const bill = await Bill.findOne({ transactionId })
        .populate('client.id', 'name email phone')
        .populate('selectedMembership', 'membershipName')
        .populate('services.id', 'serviceName')
        .populate('products.id', 'productName brand')
        .populate('services.staff', 'name')
        .populate('products.staff', 'name')
        .populate('newMemberships.id', 'membershipName')
        .populate('newMemberships.membershipId', 'membershipName type')
        .populate('business.unitId', 'unitName unitCode')
        .populate('createdBy', 'name email');
        
      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }
      res.json({ statusCode: 200, data: bill });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async cancelBill(req, res) {
    try {
      const { _id, reason } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Bill ID is required' });
      }
      
      const bill = await Bill.findByIdAndUpdate(
        _id, 
        { 
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date()
        }, 
        { new: true }
      );
      
      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }
      res.json({ 
        statusCode: 200, 
        message: 'Bill cancelled successfully',
        data: bill 
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async refundBill(req, res) {
    try {
      const { _id, refundAmount, refundReason } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Bill ID is required' });
      }
      
      const bill = await Bill.findByIdAndUpdate(
        _id, 
        { 
          status: 'refunded',
          refundAmount: refundAmount,
          refundReason: refundReason,
          refundedAt: new Date()
        }, 
        { new: true }
      );
      
      if (!bill) {
        return res.status(404).json({ error: 'Bill not found' });
      }
      res.json({ 
        statusCode: 200, 
        message: 'Bill refunded successfully',
        data: bill 
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getBillsByClient(req, res) {
    try {
      const { clientId, page = 1, limit = 10 } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: 'Client ID is required' });
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: 'selectedMembership', select: 'membershipName' },
          { path: 'services.id', select: 'serviceName' },
          { path: 'products.id', select: 'productName brand' },
          { path: 'createdBy', select: 'name email' }
        ]
      };
      
      const bills = await Bill.paginate({ 'client.id': clientId }, options);
      res.json({ statusCode: 200, data: bills });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getBillStats(req, res) {
    try {
      const { startDate, endDate, unitId } = req.body;
      
      let matchQuery = {};
      if (startDate && endDate) {
        matchQuery.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      if (unitId) {
        matchQuery['business.unitId'] = unitId;
      }
      
      const stats = await Bill.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalBills: { $sum: 1 },
            totalRevenue: { $sum: '$calculations.totals.finalAmount' },
            totalDiscount: { $sum: '$calculations.totals.totalDiscount' },
            averageBillAmount: { $avg: '$calculations.totals.finalAmount' },
            completedBills: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelledBills: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            refundedBills: {
              $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] }
            }
          }
        }
      ]);
      
      res.json({ 
        statusCode: 200, 
        data: stats.length > 0 ? stats[0] : {
          totalBills: 0,
          totalRevenue: 0,
          totalDiscount: 0,
          averageBillAmount: 0,
          completedBills: 0,
          cancelledBills: 0,
          refundedBills: 0
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new BillController();