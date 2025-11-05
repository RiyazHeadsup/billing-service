const Incentive = require('../models/Incentive');
const IncentiveDashboard = require('../models/IncentiveDashboard');
const ChildService = require('../models/ChildService');
const User = require('../models/User');
const Client = require('../models/Client');
const Account = require('../models/Account');
const IncentiveProgram = require('../models/IncentiveProgram');
const Bill = require('../models/Bill');
const { startOfDay, endOfDay, format, parseISO } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');

const { createAccountTransactionInternal } = require('./accountTransactionController');

class IncentiveController {
  async createIncentive(req, res) {
    try {
      const incentive = new Incentive(req.body);
      await incentive.save();
      
      res.status(200).json({
        success: true,
        message: "Incentive created successfully",
        statusCode: 201,
        data: incentive
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchIncentive(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { businessDate: -1 },
        populate: [
          { path: 'unitId', select: 'unitName unitCode' },
          { path: 'staffMembers.staffId', select: 'name email phoneNumber' },
          { path: 'bills.billId', select: 'billNumber transactionId' },
          { path: 'bills.clientId', select: 'name phoneNumber' },
          { path: 'createdBy', select: 'name email' },
          { path: 'calculatedBy', select: 'name email' }
        ]
      };
      
      // Transform search criteria for dashboard schema
      let searchQuery = req.body.search || {};
      
      // Map old incentive search fields to dashboard fields
      if (searchQuery.staffId) {
        searchQuery['staffMembers.staffId'] = searchQuery.staffId;
        delete searchQuery.staffId;
      }
      if (searchQuery.billId) {
        searchQuery['bills.billId'] = searchQuery.billId;
        delete searchQuery.billId;
      }
      if (searchQuery.clientId) {
        searchQuery['bills.clientId'] = searchQuery.clientId;
        delete searchQuery.clientId;
      }
      
      const dashboards = await IncentiveDashboard.paginate(searchQuery, options);
      
      // Transform response to match expected incentive format
      const transformedData = {
        ...dashboards,
        docs: dashboards.docs.map(dashboard => ({
          _id: dashboard._id,
          businessDate: dashboard.businessDate,
          unitId: dashboard.unitId,
          status: dashboard.status,
          totalIncentiveAmount: dashboard.summary.totalIncentiveGiven,
          staffCount: dashboard.summary.uniqueStaff,
          billCount: dashboard.summary.totalBills,
          serviceCount: dashboard.summary.totalServices,
          staffWithTargetAchieved: dashboard.summary.staffWithTargetAchieved,
          staffWithoutTargetAchieved: dashboard.summary.staffWithoutTargetAchieved,
          createdBy: dashboard.createdBy,
          calculatedBy: dashboard.calculatedBy,
          createdAt: dashboard.createdAt,
          updatedAt: dashboard.updatedAt,
          // Include populated data
          unitDetails: dashboard.unitId,
          staffMembers: dashboard.staffMembers,
          bills: dashboard.bills
        }))
      };
      
      res.json({ 
        statusCode: 200, 
        data: transformedData,
        message: 'Incentive dashboards retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({ statusCode: 500, error: error.message });
    }
  }

  async updateIncentive(req, res) {
    try {
      const { _id, status } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Incentive ID is required' });
      }
      
      // Get existing incentive to check status change and access staffId
      const existingIncentive = await Incentive.findById(_id);
      if (!existingIncentive) {
        return res.status(404).json({ error: 'Incentive not found' });
      }
      
      const incentive = await Incentive.findByIdAndUpdate(_id, req.body, { new: true });
      
      // If status is being updated to 'paid', create account transaction for staff
      if (status === 'paid' && existingIncentive.status !== 'paid' && existingIncentive.staffId) {
        try {
          // Find account by staffId
          const account = await Account.findOne({ userId: existingIncentive.staffId });
          
          if (account) {
            const accountTransactionResult = await createAccountTransactionInternal(
              account._id,
              'debit', // Debit the staff's account for incentive payment
              existingIncentive.incentiveAmount,
              `Incentive payment: ${existingIncentive.incentiveDescription || 'Service incentive'}`,
              'incentive',
              incentive._id,
              'incentive',
              existingIncentive.staffId,
              existingIncentive.unitId,
              req.body.approvedBy,
              `Incentive payment reference: ${incentive._id}`
            );

            if (accountTransactionResult.success) {
              console.log(`Account transaction created for staff ${existingIncentive.staffId}. Amount: ${existingIncentive.incentiveAmount}, Type: credit`);
            } else {
              console.error(`Failed to create account transaction: ${accountTransactionResult.error}`);
            }
          } else {
            console.log(`No account found for staff ${existingIncentive.staffId}`);
          }
        } catch (accountError) {
          console.error('Error creating account transaction:', accountError);
          // Don't fail the incentive update if account transaction fails
        }
      }
      
      res.json({ statusCode: 200, data: incentive });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteIncentive(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Incentive ID is required' });
      }
      const incentive = await Incentive.findByIdAndRemove(_id);
      if (!incentive) {
        return res.status(404).json({ error: 'Incentive not found' });
      }
      res.json({ statusCode: 200, message: 'Incentive deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIncentiveById(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Incentive ID is required' });
      }
      
      const incentive = await Incentive.findById(_id)
        .populate('billId', 'billNumber transactionId')
        .populate('serviceId', 'serviceName')
        .populate('staffId', 'name email phoneNumber')
        .populate('clientId', 'name phoneNumber')
        .populate('unitId', 'unitName unitCode')
        .populate('approvedBy', 'name email')
        .populate('createdBy', 'name email');
        
      if (!incentive) {
        return res.status(404).json({ error: 'Incentive not found' });
      }
      res.json({ statusCode: 200, data: incentive });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIncentivesByStaff(req, res) {
    try {
      const { staffId, status, startDate, endDate, page = 1, limit = 10 } = req.body;
      if (!staffId) {
        return res.status(400).json({ error: 'Staff ID is required' });
      }
      
      let searchQuery = { staffId };
      if (status) {
        searchQuery.status = status;
      }
      if (startDate && endDate) {
        searchQuery.businessDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { businessDate: -1 },
        populate: [
          { path: 'billId', select: 'billNumber transactionId' },
          { path: 'serviceId', select: 'serviceName' },
          { path: 'clientId', select: 'name phoneNumber' },
          { path: 'unitId', select: 'unitName unitCode' }
        ]
      };
      
      const incentives = await Incentive.paginate(searchQuery, options);
      res.json({ statusCode: 200, data: incentives });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async approveIncentive(req, res) {
    try {
      const { _id, approvedBy, notes } = req.body;
      if (!_id || !approvedBy) {
        return res.status(400).json({ error: 'Incentive ID and approvedBy are required' });
      }
      
      const incentive = await Incentive.findByIdAndUpdate(
        _id,
        {
          status: 'approved',
          approvedBy: approvedBy,
          approvedAt: new Date(),
          notes: notes
        },
        { new: true }
      );
      
      if (!incentive) {
        return res.status(404).json({ error: 'Incentive not found' });
      }
      
      res.json({
        statusCode: 200,
        message: 'Incentive approved successfully',
        data: incentive
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async markIncentivePaid(req, res) {
    try {
      const { _id, paymentMethod, paymentReference, notes } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Incentive ID is required' });
      }
      
      // First get the incentive to access staffId and incentiveAmount
      const existingIncentive = await Incentive.findById(_id);
      if (!existingIncentive) {
        return res.status(404).json({ error: 'Incentive not found' });
      }
      
      const incentive = await Incentive.findByIdAndUpdate(
        _id,
        {
          status: 'paid',
          paymentDate: new Date(),
          paymentMethod: paymentMethod,
          paymentReference: paymentReference,
          notes: notes
        },
        { new: true }
      );
      
      // Create account transaction for the staff member
      if (existingIncentive.staffId) {
        try {
          // Find account by staffId
          const account = await Account.findOne({ userId: existingIncentive.staffId });
          
          if (account) {
            const accountTransactionResult = await createAccountTransactionInternal(
              account._id,
              'credit', // Credit the staff's account for incentive payment
              existingIncentive.incentiveAmount,
              `Incentive payment: ${existingIncentive.incentiveDescription || 'Service incentive'}`,
              'incentive',
              incentive._id,
              'incentive',
              existingIncentive.staffId,
              existingIncentive.unitId,
              req.body.createdBy || existingIncentive.createdBy,
              `Incentive payment reference: ${incentive._id}`
            );

            if (accountTransactionResult.success) {
              console.log(`Account transaction created for staff ${existingIncentive.staffId}. Amount: ${existingIncentive.incentiveAmount}, Type: credit`);
            } else {
              console.error(`Failed to create account transaction: ${accountTransactionResult.error}`);
            }
          } else {
            console.log(`No account found for staff ${existingIncentive.staffId}`);
          }
        } catch (accountError) {
          console.error('Error creating account transaction:', accountError);
          // Don't fail the incentive payment if account transaction fails
        }
      }
      
      res.json({
        statusCode: 200,
        message: 'Incentive marked as paid successfully',
        data: incentive
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIncentiveStats(req, res) {
    try {
      const { staffId, unitId, startDate, endDate, status } = req.body;
      
      let matchQuery = {};
      if (staffId) matchQuery.staffId = staffId;
      if (unitId) matchQuery.unitId = unitId;
      if (status) matchQuery.status = status;
      if (startDate && endDate) {
        matchQuery.businessDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      const stats = await Incentive.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$incentiveAmount' },
            averageAmount: { $avg: '$incentiveAmount' }
          }
        },
        {
          $project: {
            status: '$_id',
            count: 1,
            totalAmount: { $round: ['$totalAmount', 2] },
            averageAmount: { $round: ['$averageAmount', 2] },
            _id: 0
          }
        }
      ]);
      
      const summary = await Incentive.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalIncentives: { $sum: 1 },
            totalAmount: { $sum: '$incentiveAmount' },
            averageAmount: { $avg: '$incentiveAmount' },
            pendingCount: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            approvedCount: {
              $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
            },
            paidCount: {
              $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
            }
          }
        }
      ]);
      
      res.json({
        statusCode: 200,
        data: {
          byStatus: stats,
          summary: summary.length > 0 ? summary[0] : {
            totalIncentives: 0,
            totalAmount: 0,
            averageAmount: 0,
            pendingCount: 0,
            approvedCount: 0,
            paidCount: 0
          }
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async calculateDailyIncentive(req, res) {
    try {
      console.log('🔍 calculateDailyIncentive called with body:', JSON.stringify(req.body, null, 2));
      
      const { unitId, calculatedBy, businessDate } = req.body;
      
      if (!unitId || !calculatedBy || !businessDate) {
        console.log('❌ Missing required fields:', { unitId, calculatedBy, businessDate });
        return res.status(400).json({
          error: 'unitId, calculatedBy, and businessDate are required'
        });
      }

      console.log('✅ Required fields validated:', { unitId, calculatedBy, businessDate });

      // Get business date boundaries (start and end of specified business date) using date-fns
   const receivedDate = new Date(businessDate);

      // Add the timezone offset to get back to the intended date
      // GMT+5:30 = 5.5 hours = 330 minutes
      const timezoneOffsetMinutes = 330; // India Standard Time offset
      const adjustedDate = new Date(receivedDate.getTime() + (timezoneOffsetMinutes * 60 * 1000));

      const dayStart = startOfDay(adjustedDate);
      const dayEnd = endOfDay(adjustedDate);
      
      console.log('📅 Date conversion using date-fns:', {
        inputBusinessDate: businessDate,
        inputBusinessDateFormatted: format(adjustedDate, 'yyyy-MM-dd HH:mm:ss'),
        calculatedStartOfDay: dayStart.getTime(),
        calculatedStartOfDayFormatted: format(dayStart, 'yyyy-MM-dd HH:mm:ss'),
        calculatedEndOfDay: dayEnd.getTime(),
        calculatedEndOfDayFormatted: format(dayEnd, 'yyyy-MM-dd HH:mm:ss')
      });



      console.log('Fetching bills for date range:', {
        startOfDay1: dayStart.getTime(),
        endOfDay: dayEnd.getTime(),
        unitId
      });

      console.log('🔍 Looking for active incentive program for unitId:', unitId);
      const unitIncentiveProgram = await IncentiveProgram.findOne({
        unitIds: { $in: [unitId] },
        status: 'active'
      });
      
      if (!unitIncentiveProgram) {
        console.log('❌ No active incentive program found for unitId:', unitId);
        return res.status(404).json({
          error: 'No active incentive program found for this unit'
        });
      }
      
      console.log('✅ Found incentive program:', unitIncentiveProgram._id);

      // Extract daily target incentive configuration
      const dailyIncentiveProgram = unitIncentiveProgram?.dailyTragetIncentive || null;

      // Fetch all bills for specified business date and unit
      console.log('🔍 Fetching bills for date range and unit:', {
        unitId,
        startTime: dayStart.getTime(),
        endTime: dayEnd.getTime()
      });
      
      const businessDateBills = await Bill.find({
        unitId: unitId,
        createdAt: {
          $gte: dayStart.getTime(),
          $lte: dayEnd.getTime()
        },
        status: { $nin: ['cancelled', 'refunded'] } // Exclude cancelled/refunded bills
      });
      
      console.log(`✅ Found ${businessDateBills.length} bills for the specified date and unit`);

      // Get unique staff IDs from business date bills
      const staffIds = [...new Set(businessDateBills.flatMap(bill => 
        bill.services?.map(service => service.staff?.toString()).filter(Boolean) || []
      ))];

      // Fetch staff details with salary information
      console.log(`🔍 Fetching details for ${staffIds.length} unique staff members:`, staffIds);
      const staffMembers = await User.find({
        _id: { $in: staffIds },
        unitIds: { $in: [unitId] }
      }).select('name email salary unitIds');
      
      console.log(`✅ Found ${staffMembers.length} staff members in database`);

      // Calculate service value done by each staff member
      const staffPerformance = staffMembers.map(staff => {
        const staffId = staff._id.toString();
        
        // Calculate total service value and incentives for this staff member
        let totalServiceValue = 0;
        let serviceCount = 0;
        let totalIncentiveAmount = 0;
        let servicesPerformed = [];

        businessDateBills.forEach(bill => {
          if (bill.services) {
            bill.services.forEach(service => {
              if (service.staff && service.staff.toString() === staffId) {
                const serviceValue = service.pricing?.finalPrice || 0;
                const incentivePercentage = service.incentive || 0;
                const incentiveAmount = incentivePercentage > 0 ? Math.round((serviceValue * incentivePercentage) / 100) : 0;
                
                totalServiceValue += serviceValue;
                totalIncentiveAmount += incentiveAmount;
                serviceCount++;
                
                servicesPerformed.push({
                  billNumber: bill.billNumber,
                  serviceName: service.name,
                  finalPrice: serviceValue,
                  incentivePercentage: incentivePercentage,
                  incentiveAmount: incentiveAmount,
                  clientName: bill.client?.name || 'Unknown'
                });
              }
            });
          }
        });

        // Calculate daily salary and target
        const dailySalary = staff.salary ? Math.round(staff.salary / 26) : 0;
        const dailyTarget = staff.salary && dailyIncentiveProgram?.targetValue 
          ? Math.round((staff.salary / 26) * dailyIncentiveProgram.targetValue) 
          : 0;

        // Check if target is achieved
        const targetAchieved = totalServiceValue >= dailyTarget && dailyTarget > 0;
        
        // Calculate incentive only if target is achieved
        const finalIncentiveAmount = targetAchieved ? totalIncentiveAmount : 0;
        
        // Update services performed to show if incentive is awarded
        const updatedServicesPerformed = servicesPerformed.map(service => ({
          ...service,
          incentiveAwarded: targetAchieved,
          finalIncentiveAmount: targetAchieved ? service.incentiveAmount : 0
        }));

        return {
          ...staff.toObject(),
          dailySalary,
          dailyTarget,
          totalServiceValue,
          totalIncentiveAmount: finalIncentiveAmount,
          serviceCount,
          servicesPerformed: updatedServicesPerformed,
          targetAchieved,
          targetPercentage: dailyTarget > 0 ? Math.round((totalServiceValue / dailyTarget) * 100) : 0,
          incentiveEligible: targetAchieved
        };
      });

      // Check if dashboard already exists for this date and unit
      console.log('🔍 Checking for existing dashboard:', {
        businessDate: businessDate,
        unitId: unitId
      });
      
      let existingDashboard = await IncentiveDashboard.findOne({
        businessDate: businessDate,
        unitId: unitId
      });
      
      console.log('📊 Existing dashboard found:', existingDashboard ? `Yes (ID: ${existingDashboard._id})` : 'No');

      // Prepare bills data for dashboard - lightweight references only
      const billsData = businessDateBills.map(bill => ({
        billId: bill._id,
        billNumber: bill.billNumber,
        transactionId: bill.transactionId,
        timestamp: bill.timestamp instanceof Date ? bill.timestamp.getTime() : bill.timestamp,
        finalAmount: bill.calculations?.totals?.finalAmount || 0,
        serviceCount: bill.services?.length || 0,
        clientId: bill.client?._id,
        status: bill.status
      }));

      // Prepare summary data
      const summaryData = {
        totalBills: businessDateBills.length,
        totalRevenue: businessDateBills.reduce((sum, bill) => sum + (bill.calculations?.totals?.finalAmount || 0), 0),
        uniqueStaff: staffPerformance.length,
        totalServices: businessDateBills.reduce((sum, bill) => sum + (bill.services?.length || 0), 0),
        totalIncentiveGiven: staffPerformance.reduce((sum, staff) => sum + staff.totalIncentiveAmount, 0),
        staffWithTargetAchieved: staffPerformance.filter(staff => staff.targetAchieved).length,
        staffWithoutTargetAchieved: staffPerformance.filter(staff => !staff.targetAchieved).length,
        totalIncentiveRecords: 0, // Will be updated after incentive records creation
        incentiveRecordsCreated: 0
      };

      let savedDashboard;

      if (existingDashboard) {
        // Update existing dashboard
        console.log('🔄 Updating existing dashboard with ID:', existingDashboard._id);
        
        existingDashboard.bills = billsData;
        existingDashboard.incentiveProgram = {
          _id: unitIncentiveProgram._id,
          dailyTragetIncentive: unitIncentiveProgram.dailyTragetIncentive,
          productIncentive: unitIncentiveProgram.productIncentive,
          monthlyIncentive: unitIncentiveProgram.monthlyIncentive,
          status: unitIncentiveProgram.status
        };
        existingDashboard.dailyIncentiveProgram = dailyIncentiveProgram;
        existingDashboard.staffMembers = []; // Will be updated after calculations
        existingDashboard.summary = summaryData;
        existingDashboard.calculatedBy = calculatedBy;
        existingDashboard.calculatedAt = Date.now();
        existingDashboard.status = 'calculated';

        console.log('💾 Saving updated dashboard...');
        savedDashboard = await existingDashboard.save();
        console.log('✅ Dashboard updated successfully with ID:', savedDashboard._id);
      } else {
  
      
        
        const dashboardData = {
          businessDate: businessDate,
          unitId: unitId,
          bills: billsData,
          incentiveProgram: {
            _id: unitIncentiveProgram._id,
            dailyTragetIncentive: unitIncentiveProgram.dailyTragetIncentive,
            productIncentive: unitIncentiveProgram.productIncentive,
            monthlyIncentive: unitIncentiveProgram.monthlyIncentive,
            status: unitIncentiveProgram.status
          },
          dailyIncentiveProgram: dailyIncentiveProgram,
          staffMembers: [], // Will be populated after calculations
          summary: summaryData,
          createdBy: calculatedBy,
          calculatedBy: calculatedBy,
          status: 'calculated'
        };

        console.log('📋 Dashboard data prepared:', {
          businessDate: dashboardData.businessDate,
          unitId: dashboardData.unitId,
          billsCount: dashboardData.bills.length,
          status: dashboardData.status
        });

        savedDashboard = new IncentiveDashboard(dashboardData);
        console.log('💾 Saving new dashboard...');
        await savedDashboard.save();
        console.log('✅ Dashboard created successfully with ID:', savedDashboard._id);
      }

      // Prepare simplified staff members data - no individual incentive records needed
      const staffMembersData = staffPerformance.map(staff => ({
        staffId: staff._id,
        staffName: staff.name,
        salary: staff.salary,
        dailySalary: staff.dailySalary,
        dailyTarget: staff.dailyTarget,
        totalServiceValue: staff.totalServiceValue,
        totalIncentiveAmount: staff.totalIncentiveAmount,
        serviceCount: staff.serviceCount,
        targetAchieved: staff.targetAchieved,
        targetPercentage: staff.targetPercentage,
        incentiveEligible: staff.incentiveEligible
      }));

      // Update dashboard with simplified staff data
      console.log('👥 Updating dashboard with staff members data:', {
        staffCount: staffMembersData.length,
        dashboardId: savedDashboard._id
      });
      
      savedDashboard.staffMembers = staffMembersData;
      // No individual incentive records - all data stored in dashboard
      console.log('💾 Final save of dashboard with staff data...');
      await savedDashboard.save();
      console.log('✅ Dashboard final save completed successfully');


      res.json({
        statusCode: 200,
        message: existingDashboard 
          ? 'Daily incentive dashboard updated successfully for specified business date' 
          : 'Daily incentive dashboard created successfully for specified business date',
        data: {
          dashboard: savedDashboard,
          dashboardId: savedDashboard._id,
          isUpdate: !!existingDashboard,
          billsProcessed: businessDateBills.length,
          incentiveProgram: unitIncentiveProgram,
          dailyIncentiveProgram: dailyIncentiveProgram,
          staffMembersProcessed: staffPerformance.length,
          incentiveRecordsCreated: 0, // No individual records, data stored in dashboard only
          summary: savedDashboard.summary,
          // For detailed data, populate dashboard references
          populateInstructions: {
            bills: "Use populate('bills.billId bills.clientId') for full bill details",
            staff: "Use populate('staffMembers.staffId') for full staff details",
            note: "All incentive data is stored within the dashboard - no separate incentive records"
          }
        }
      });
    } catch (error) {
      console.error('❌ Error in calculateDailyIncentive:', error);
      console.error('❌ Error stack:', error.stack);
      res.status(500).json({ 
        error: error.message,
        timestamp: new Date().toISOString(),
        endpoint: 'calculateDailyIncentive'
      });
    }
  }
}

module.exports = new IncentiveController();