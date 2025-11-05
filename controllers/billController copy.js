const Bill = require('../models/Bill');
const ClientMembership = require('../models/ClientMembership');

async function createClientMemberships(newMemberships, clientId, createdBy) {
  try {
    for (const membership of newMemberships) {
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
        membershipId: membership.membershipId,
        membershipName: membership.name,
        membershipType: membership.type,
        description: membership.description,
        purchaseAmount: membership.pricing.purchaseAmount,
        startDate: startDate,
        endDate: endDate,
        isActive: true,
        status: 'active',
        benefits: membership.benefits,
        duration: membership.duration,
        createdBy: createdBy
      };

      const clientMembership = new ClientMembership(clientMembershipData);
      await clientMembership.save();
    }
  } catch (error) {
    console.error('Error creating client memberships:', error);
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