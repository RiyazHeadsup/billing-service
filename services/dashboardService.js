const DailyDashboard = require('../models/DailyDashboard');

class DashboardService {
  async updateDashboardWithBill(bill, incentiveResult = null) {
    try {
      const today = this.getDateNumber(new Date());
      const unitId = bill?.unitId;

      if (!unitId) {
        console.log('Unit ID not found in bill, skipping dashboard update');
        return;
      }

      // Get start and end of today for createdAt range query
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      let dashboard = await DailyDashboard.findOne({ 
        unitId: unitId,
        createdAt: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });

      if (!dashboard) {
        dashboard = await this.createNewDashboard(today, unitId);
      }

      this.updateDashboardWithBillData(dashboard, bill);
      
      // Update incentives data if available
      if (incentiveResult && incentiveResult.success) {
        this.updateIncentivesData(dashboard, incentiveResult);
      }
      
      await dashboard.save();

      console.log(`Dashboard updated for date ${today} and unit ${unitId}`);
      if (incentiveResult && incentiveResult.success) {
        console.log(`Incentives updated: ₹${incentiveResult.totalIncentiveAmount.toFixed(2)} added to dashboard`);
      }
    } catch (error) {
      console.error('Error updating dashboard with bill:', error);
    }
  }

  async createNewDashboard(date, unitId) {
    return new DailyDashboard({
      date: date,
      unitId: unitId,
      sales: {
        totalBills: 0,
        totalRevenue: 0,
        services: { count: 0, revenue: 0 },
        products: { count: 0, revenue: 0 },
        memberships: { count: 0, revenue: 0 }
      },
      payments: {
        cash: 0,
        card: 0,
        upi: 0,
        wallet: 0,
        totalCollected: 0,
        changeReturned: 0
      },
      discounts: {
        totalDiscountGiven: 0,
        couponDiscount: 0,
        membershipDiscount: 0,
        totalCouponsUsed: 0
      },
      clients: {
        totalClients: 0,
        newClients: 0,
        returningClients: 0
      },
      bills: {
        completed: 0,
        pending: 0,
        cancelled: 0,
        refunded: 0
      },
      expenses: {
        rent: 0,
        electricity: 0,
        incentives: 0,
        other: 0,
        totalExpenses: 0
      },
      avgBillValue: 0,
      netProfit: 0,
      topServices: [],
      topProducts: [],
      staffPerformance: []
    });
  }

  updateDashboardWithBillData(dashboard, bill) {
    // Update sales data
    dashboard.sales.totalBills += 1;
    dashboard.sales.totalRevenue += bill.calculations?.totals?.finalAmount || 0;

    // Update client data
    this.updateClientData(dashboard, bill);

    // Update services data
    if (bill.services && bill.services.length > 0) {
      dashboard.sales.services.count += bill.services.length;
      const servicesRevenue = bill.services.reduce((sum, service) => 
        sum + (service.pricing?.totalPrice || 0), 0);
      dashboard.sales.services.revenue += servicesRevenue;

      // Update top services
      this.updateTopServices(dashboard, bill.services);
    }

    // Update products data
    if (bill.products && bill.products.length > 0) {
      dashboard.sales.products.count += bill.products.length;
      const productsRevenue = bill.products.reduce((sum, product) => 
        sum + (product.pricing?.totalPrice || 0), 0);
      dashboard.sales.products.revenue += productsRevenue;

      // Update top products
      this.updateTopProducts(dashboard, bill.products);
    }

    // Update memberships data
    if (bill.newMemberships && bill.newMemberships.length > 0) {
      dashboard.sales.memberships.count += bill.newMemberships.length;
      const membershipsRevenue = bill.newMemberships.reduce((sum, membership) => 
        sum + (membership.pricing?.finalPrice || 0), 0);
      dashboard.sales.memberships.revenue += membershipsRevenue;
    }

    // Update payment methods
    if (bill.payment?.methods) {
      // Calculate actual cash received (subtract change returned)
      const cashReceived = (bill.payment.methods.cash || 0) - (bill.changeReturned || 0);
      
      dashboard.payments.cash += cashReceived;
      dashboard.payments.card += bill.payment.methods.card || 0;
      dashboard.payments.upi += bill.payment.methods.upi || 0;
      dashboard.payments.wallet += bill.payment.methods.wallet || 0;
      
      // Track change returned
      dashboard.payments.changeReturned += bill.changeReturned || 0;
      
      // Total collected should be the actual amount kept (excluding change returned)
      const actualTotalCollected = (bill.payment.totalPaid || 0) - (bill.changeReturned || 0);
      dashboard.payments.totalCollected += actualTotalCollected;
      
      console.log('Payment tracking:');
      console.log('- Cash paid:', bill.payment.methods.cash);
      console.log('- Change returned:', bill.changeReturned);
      console.log('- Actual cash received:', cashReceived);
      console.log('- Total paid:', bill.payment.totalPaid);
      console.log('- Actual total collected:', actualTotalCollected);
    }

    // Update discounts
    if (bill.calculations?.totals?.totalDiscount) {
      dashboard.discounts.totalDiscountGiven += bill.calculations.totals.totalDiscount;
    }
    if (bill.calculations?.totals?.couponDiscount) {
      dashboard.discounts.couponDiscount += bill.calculations.totals.couponDiscount;
    }
    if (bill.appliedCoupon?.code) {
      dashboard.discounts.totalCouponsUsed += 1;
    }

    // Update bill status counts
    const status = bill.status || 'completed';
    if (dashboard.bills[status] !== undefined) {
      dashboard.bills[status] += 1;
    }

    // Update average bill value
    if (dashboard.sales.totalBills > 0) {
      dashboard.avgBillValue = dashboard.sales.totalRevenue / dashboard.sales.totalBills;
    }

    // Update staff performance
    this.updateStaffPerformance(dashboard, bill);

    // Recalculate total expenses
    dashboard.expenses.totalExpenses = dashboard.expenses.rent + 
                                     dashboard.expenses.electricity + 
                                     dashboard.expenses.incentives + 
                                     dashboard.expenses.other;

    // Calculate net profit (revenue - expenses)
    dashboard.netProfit = dashboard.sales.totalRevenue - dashboard.expenses.totalExpenses;
  }

  updateTopServices(dashboard, billServices) {
    billServices.forEach(service => {
      if (!service.id || !service.name) return;

      const existingService = dashboard.topServices.find(ts => 
        ts.serviceId && ts.serviceId.toString() === service.id.toString());

      if (existingService) {
        existingService.count += service.quantity || 1;
        existingService.revenue += service.pricing?.totalPrice || 0;
      } else {
        dashboard.topServices.push({
          serviceId: service.id,
          serviceName: service.name,
          count: service.quantity || 1,
          revenue: service.pricing?.totalPrice || 0
        });
      }
    });

    // Sort and keep top 10
    dashboard.topServices.sort((a, b) => b.revenue - a.revenue);
    dashboard.topServices = dashboard.topServices.slice(0, 10);
  }

  updateTopProducts(dashboard, billProducts) {
    billProducts.forEach(product => {
      if (!product.id || !product.name) return;

      const existingProduct = dashboard.topProducts.find(tp => 
        tp.productId && tp.productId.toString() === product.id.toString());

      if (existingProduct) {
        existingProduct.count += product.quantity || 1;
        existingProduct.revenue += product.pricing?.totalPrice || 0;
      } else {
        dashboard.topProducts.push({
          productId: product.id,
          productName: product.name,
          count: product.quantity || 1,
          revenue: product.pricing?.totalPrice || 0
        });
      }
    });

    // Sort and keep top 10
    dashboard.topProducts.sort((a, b) => b.revenue - a.revenue);
    dashboard.topProducts = dashboard.topProducts.slice(0, 10);
  }

  updateClientData(dashboard, bill) {
    if (!bill.client?.id) return;

    const clientId = bill.client.id.toString();
    
    // Check if this client has been seen today
    if (!dashboard.clientsToday) {
      dashboard.clientsToday = new Set();
    }
    
    // If client hasn't been counted today, increment total clients
    if (!dashboard.clientsToday.has(clientId)) {
      dashboard.clients.totalClients += 1;
      dashboard.clientsToday.add(clientId);
      
      // Determine if new or returning client based on bill date and client creation
      // For now, we'll use a simple heuristic: if this is their first bill today, consider patterns
      const isNewClient = this.isNewClient(bill);
      
      if (isNewClient) {
        dashboard.clients.newClients += 1;
      } else {
        dashboard.clients.returningClients += 1;
      }
    }
  }

  isNewClient(bill) {
    console.log('=== isNewClient Debug ===',bill.client);
    console.log('Client ID:', bill.client?.id || bill.client?._id);
    console.log('Client Name:', bill.client?.name);
    
    // Use client.createdAt or createdAtISO to determine if client is new
    let clientCreatedAt;
    
    // Check all possible creation date fields
    console.log('Available date fields:');
    console.log('- createdAt:', bill.client?.createdAt);
    console.log('- createdAtISO:', bill.client?.createdAtISO);
    console.log('- createdAt type:', typeof bill.client?.createdAt);
    
    if (bill.client?.createdAtISO) {
      clientCreatedAt = new Date(bill.client.createdAtISO);
      console.log('Using createdAtISO:', bill.client.createdAtISO);
    } else if (bill.client?.createdAt) {
      clientCreatedAt = new Date(bill.client.createdAt);
      console.log('Using createdAt:', bill.client.createdAt);
    } else {
      console.log('No creation date available, defaulting to returning client');
      return false; // No creation date available
    }

    const today = new Date();
    
    console.log('Parsed client creation date:', clientCreatedAt.toISOString());
    console.log('Current date:', today.toISOString());
    
    // Calculate difference in milliseconds
    const diffInMs = today.getTime() - clientCreatedAt.getTime();
    
    // Convert milliseconds to days
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    console.log('Difference in milliseconds:', diffInMs);
    console.log('Difference in days:', diffInDays);
    
    // Client is new if they were created within the last 1 day
    const isNew = diffInDays <= 1;
    console.log('Is new client:', isNew);
    console.log('=== End Debug ===');
    
    return isNew;
  }

  updateIncentivesData(dashboard, incentiveResult) {
    if (!incentiveResult || !incentiveResult.success) return;

    // Update total incentives in expenses
    dashboard.expenses.incentives += incentiveResult.totalIncentiveAmount;

    // Update staff performance with incentives
    incentiveResult.createdIncentives.forEach(incentive => {
      const existingStaff = dashboard.staffPerformance.find(sp => 
        sp.staffId && sp.staffId.toString() === incentive.staffId.toString());

      if (existingStaff) {
        existingStaff.incentivesEarned += incentive.incentiveAmount;
      } else {
        // If staff not found, create new entry
        dashboard.staffPerformance.push({
          staffId: incentive.staffId,
          staffName: 'Staff Name', // This should be populated from staff data
          totalSales: 0,
          billsHandled: 0,
          incentivesEarned: incentive.incentiveAmount
        });
      }
    });

    console.log(`💰 Dashboard incentives updated: +₹${incentiveResult.totalIncentiveAmount.toFixed(2)}`);
    console.log(`📊 Total incentives expense now: ₹${dashboard.expenses.incentives.toFixed(2)}`);
  }

  updateStaffPerformance(dashboard, bill) {
    const staffIds = new Set();
    
    // Collect staff IDs from services
    if (bill.services) {
      bill.services.forEach(service => {
        if (service.staff) staffIds.add(service.staff.toString());
      });
    }

    // Collect staff IDs from products
    if (bill.products) {
      bill.products.forEach(product => {
        if (product.staff) staffIds.add(product.staff.toString());
      });
    }

    // Collect staff IDs from memberships
    if (bill.newMemberships) {
      bill.newMemberships.forEach(membership => {
        if (membership.staff) staffIds.add(membership.staff.toString());
      });
    }

    // Update staff performance
    staffIds.forEach(staffId => {
      const existingStaff = dashboard.staffPerformance.find(sp => 
        sp.staffId && sp.staffId.toString() === staffId);

      if (existingStaff) {
        existingStaff.totalSales += bill.calculations?.totals?.finalAmount || 0;
        existingStaff.billsHandled += 1;
      } else {
        dashboard.staffPerformance.push({
          staffId: staffId,
          staffName: 'Staff Name', // This should be populated from staff data
          totalSales: bill.calculations?.totals?.finalAmount || 0,
          billsHandled: 1,
          incentivesEarned: 0
        });
      }
    });
  }

  getDateNumber(date) {
    // Convert date to YYYYMMDD format as number
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return parseInt(`${year}${month}${day}`);
  }
}

module.exports = new DashboardService();