require('dotenv').config();
const express = require('express');
const DatabaseConfig = require('./config/database');
const ConsulConfig = require('./config/consul');
const walletRoutes = require('./routes/walletRoutes');
const walletTransactionRoutes = require('./routes/walletTransactionRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const clientMembershipRoutes = require('./routes/clientMembershipRoutes');
const packageRoutes = require('./routes/packageRoutes');
const couponRoutes = require('./routes/couponRoutes');
const billRoutes = require('./routes/billRoutes');
const cashBalanceRoutes = require('./routes/cashBalanceRoutes');
const cashTransactionRoutes = require('./routes/cashTransactionRoutes');
const dailyDashboardRoutes = require('./routes/dailyDashboardRoutes');
const accountRoutes = require('./routes/accountRoutes');
const accountTransactionRoutes = require('./routes/accountTransactionRoutes');
const incentiveRoutes = require('./routes/incentiveRoutes');
const incentiveProgramRoutes = require('./routes/incentiveProgramRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = parseInt(process.env.PORT) || 5001;

app.use(express.json());

const database = new DatabaseConfig();
const consulConfig = new ConsulConfig({
  servicePort: PORT
});

app.use('/', walletRoutes);
app.use('/', walletTransactionRoutes);
app.use('/', membershipRoutes);
app.use('/', clientMembershipRoutes);
app.use('/', packageRoutes);
app.use('/', couponRoutes);
app.use('/', billRoutes);
app.use('/', cashBalanceRoutes);
app.use('/', cashTransactionRoutes);
app.use('/', dailyDashboardRoutes);
app.use('/', accountRoutes);
app.use('/', accountTransactionRoutes);
app.use('/', incentiveRoutes);
app.use('/', incentiveProgramRoutes);
app.use('/', bookingRoutes);
app.use('/', paymentRoutes);

async function startServer() {
  try {
    await database.connect();

    app.listen(PORT, async () => {
      console.log(`🚀 Billing service running on port ${PORT}`);
      console.log(`📍 Available endpoints:`);
      console.log(`   GET  /health - Service health check`);
      console.log(`   POST /addWallet - Create new wallet`);
      console.log(`   POST /searchWallet - Search wallets`);
      console.log(`   POST /updateWallet - Update wallet`);
      console.log(`   POST /deleteWallet - Delete wallet`);
      console.log(`   POST /createWalletTransaction - Create wallet transaction`);
      console.log(`   POST /getWalletTransactions - Get all wallet transactions`);
      console.log(`   POST /getWalletTransactionsByWallet - Get transactions by wallet`);
      console.log(`   POST /getWalletTransactionsByClient - Get transactions by client`);
      console.log(`   POST /getWalletTransactionById - Get transaction by ID`);
      console.log(`   POST /getWalletBalance - Get wallet balance`);
      console.log(`   POST /getWalletTransactionStats - Get transaction statistics`);
      console.log(`   POST /addMembership - Create new membership`);
      console.log(`   POST /searchMembership - Search memberships`);
      console.log(`   POST /updateMembership - Update membership`);
      console.log(`   POST /deleteMembership - Delete membership`);
      console.log(`   POST /addClientMembership - Create new client membership`);
      console.log(`   POST /searchClientMembership - Search client memberships`);
      console.log(`   POST /updateClientMembership - Update client membership`);
      console.log(`   POST /deleteClientMembership - Delete client membership`);
      console.log(`   POST /addPackage - Create new package`);
      console.log(`   POST /searchPackage - Search packages`);
      console.log(`   POST /updatePackage - Update package`);
      console.log(`   POST /deletePackage - Delete package`);
      console.log(`   POST /addCoupon - Create new coupon`);
      console.log(`   POST /searchCoupon - Search coupons`);
      console.log(`   POST /updateCoupon - Update coupon`);
      console.log(`   POST /deleteCoupon - Delete coupon`);
      console.log(`   POST /validateCoupon - Validate coupon`);
      console.log(`   POST /applyCoupon - Apply coupon`);
      console.log(`   POST /addBill - Create new bill`);
      console.log(`   POST /searchBill - Search bills`);
      console.log(`   POST /updateBill - Update bill`);
      console.log(`   POST /deleteBill - Delete bill`);
      console.log(`   POST /getBillByNumber - Get bill by number`);
      console.log(`   POST /getBillByTransactionId - Get bill by transaction ID`);
      console.log(`   POST /cancelBill - Cancel bill`);
      console.log(`   POST /refundBill - Refund bill`);
      console.log(`   POST /getBillsByClient - Get bills by client`);
      console.log(`   POST /getBillStats - Get bill statistics`);
      console.log(`   POST /addCashBalance - Create new cash balance`);
      console.log(`   POST /searchCashBalance - Search cash balances`);
      console.log(`   POST /updateCashBalance - Update cash balance`);
      console.log(`   POST /deleteCashBalance - Delete cash balance`);
      console.log(`   POST /addCashTransaction - Create new cash transaction`);
      console.log(`   POST /searchCashTransaction - Search cash transactions`);
      console.log(`   POST /updateCashTransaction - Update cash transaction`);
      console.log(`   POST /deleteCashTransaction - Delete cash transaction`);
      console.log(`   POST /addAccount - Create new account`);
      console.log(`   POST /searchAccount - Search accounts`);
      console.log(`   POST /updateAccount - Update account`);
      console.log(`   POST /deleteAccount - Delete account`);
      console.log(`   POST /addAccountTransaction - Create new account transaction`);
      console.log(`   POST /searchAccountTransaction - Search account transactions`);
      console.log(`   POST /updateAccountTransaction - Update account transaction`);
      console.log(`   POST /deleteAccountTransaction - Delete account transaction`);
      console.log(`   POST /addIncentive - Create new incentive`);
      console.log(`   POST /searchIncentive - Search incentives`);
      console.log(`   POST /updateIncentive - Update incentive`);
      console.log(`   POST /deleteIncentive - Delete incentive`);
      console.log(`   POST /getIncentiveById - Get incentive by ID`);
      console.log(`   POST /getIncentivesByStaff - Get incentives by staff`);
      console.log(`   POST /approveIncentive - Approve incentive`);
      console.log(`   POST /markIncentivePaid - Mark incentive as paid`);
      console.log(`   POST /getIncentiveStats - Get incentive statistics`);
      console.log(`   POST /calculateDailyIncentive - Calculate daily incentive for staff`);
      console.log(`   POST /addIncentiveProgram - Create new incentive program`);
      console.log(`   POST /searchIncentiveProgram - Search incentive programs`);
      console.log(`   POST /updateIncentiveProgram - Update incentive program`);
      console.log(`   POST /deleteIncentiveProgram - Delete incentive program`);
      console.log(`   POST /getIncentiveProgramById - Get incentive program by ID`);
      console.log(`   POST /getIncentiveProgramsByUnit - Get incentive programs by unit`);
      console.log(`   POST /activateIncentiveProgram - Activate incentive program`);
      console.log(`   POST /deactivateIncentiveProgram - Deactivate incentive program`);
      console.log(`   POST /getIncentiveProgramStats - Get incentive program statistics`);
      console.log(`   POST /addToCart - Add booking to cart`);
      console.log(`   POST /getCart - Get cart items for client`);
      console.log(`   POST /updateCart - Update cart item`);
      console.log(`   POST /removeFromCart - Remove item from cart`);
      console.log(`   POST /clearCart - Clear client cart`);
      console.log(`   POST /bookFromCart - Confirm bookings from cart`);
      console.log(`   POST /addBooking - Create booking directly`);
      console.log(`   POST /searchBooking - Search bookings`);
      console.log(`   POST /updateBooking - Update booking`);
      console.log(`   POST /deleteBooking - Delete booking`);
      console.log(`   POST /getBookingByNumber - Get booking by number`);
      console.log(`   POST /getBookingsByClient - Get bookings by client`);
      console.log(`   POST /cancelBooking - Cancel booking`);
      console.log(`   POST /rescheduleBooking - Reschedule booking`);
      console.log(`   POST /completeBooking - Complete booking`);
      console.log(`   POST /initiatePayment - Initiate Paytm payment`);
      console.log(`   POST /initiateBookingPayment - Initiate payment for bookings`);
      console.log(`   POST /paymentCallback - Paytm payment callback`);
      console.log(`   POST /getPaymentStatus - Check payment status`);
      console.log(`   POST /searchPayment - Search payments`);
      console.log(`   POST /getPaymentsByClient - Get payments by client`);
      console.log(`   POST /initiateRefund - Initiate refund`);

      await consulConfig.registerService();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down billing service...');
  await consulConfig.deregisterService();
  await database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down billing service...');
  await consulConfig.deregisterService();
  await database.disconnect();
  process.exit(0);
});

startServer();