const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const paytmService = require('../services/paytmService');

class PaymentController {
  // Initiate payment for any purpose (standalone)
  async initiatePayment(req, res) {
    try {
      const { amount, clientId, bookingId, billId, unitId, createdBy, remarks } = req.body;

      if (!amount || !clientId) {
        return res.status(400).json({ error: 'amount and clientId are required' });
      }

      const orderId = paytmService.generateOrderId('ORD');

      // Create payment record
      const payment = new Payment({
        orderId,
        clientId,
        amount,
        bookingId: bookingId || null,
        billId: billId || null,
        unitId: unitId || null,
        createdBy: createdBy || null,
        remarks: remarks || null,
        paymentStatus: 'INITIATED'
      });
      await payment.save();

      // Call Paytm initiate transaction
      const paytmResponse = await paytmService.initiateTransaction(orderId, amount, clientId);

      if (paytmResponse.body && paytmResponse.body.resultInfo && paytmResponse.body.resultInfo.resultStatus === 'S') {
        payment.txnToken = paytmResponse.body.txnToken;
        await payment.save();

        res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Payment initiated successfully',
          data: {
            orderId: orderId,
            txnToken: paytmResponse.body.txnToken,
            amount: amount,
            mid: paytmService.mid,
            callbackUrl: paytmService.callbackUrl,
            paymentId: payment._id
          }
        });
      } else {
        payment.paymentStatus = 'TXN_FAILURE';
        payment.gatewayResponse = {
          respCode: paytmResponse.body?.resultInfo?.resultCode,
          respMsg: paytmResponse.body?.resultInfo?.resultMsg
        };
        await payment.save();

        res.status(400).json({
          success: false,
          message: 'Payment initiation failed',
          error: paytmResponse.body?.resultInfo?.resultMsg || 'Unknown error',
          data: paytmResponse
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Initiate payment for booking (from cart flow)
  async initiateBookingPayment(req, res) {
    try {
      const { clientId, bookingIds, amount, unitId, createdBy, bookingDate, bookingTime, scheduledDate, scheduledTime, serviceType } = req.body;

      if (!clientId || !amount) {
        return res.status(400).json({ error: 'clientId and amount are required' });
      }

      // If bookingIds provided, validate they exist and belong to client
      let bookings = [];
      if (bookingIds && bookingIds.length > 0) {
        bookings = await Booking.find({
          _id: { $in: bookingIds },
          'client.id': clientId,
          bookingStatus: { $in: ['IN_CART', 'PENDING'] }
        });

        if (bookings.length === 0) {
          return res.status(400).json({ error: 'No valid bookings found' });
        }
      } else {
        // Get all cart items for client (include PENDING in case previous payment attempt was interrupted)
        bookings = await Booking.find({
          'client.id': clientId,
          bookingStatus: { $in: ['IN_CART', 'PENDING'] }
        });

        if (bookings.length === 0) {
          return res.status(400).json({ error: 'Cart is empty' });
        }
      }

      const orderId = paytmService.generateOrderId('BKG');

      // Mark bookings as PENDING payment and set schedule details
      for (const booking of bookings) {
        booking.bookingStatus = 'PENDING';
        booking.status = 'pending';
        if (bookingDate) booking.bookingDate = bookingDate;
        if (bookingTime) booking.bookingTime = bookingTime;
        if (scheduledDate) booking.scheduledDate = scheduledDate;
        if (scheduledTime) booking.scheduledTime = scheduledTime;
        if (serviceType) booking.serviceType = serviceType;
        await booking.save();
      }

      // Create payment record linked to first booking (or use array)
      const payment = new Payment({
        orderId,
        clientId,
        amount,
        bookingId: bookings[0]._id,
        unitId: unitId || null,
        createdBy: createdBy || null,
        remarks: `Payment for ${bookings.length} booking(s): ${bookings.map(b => b.bookingNumber).join(', ')}`,
        paymentStatus: 'INITIATED'
      });
      await payment.save();

      // Call Paytm
      const paytmResponse = await paytmService.initiateTransaction(orderId, amount, clientId);

      if (paytmResponse.body && paytmResponse.body.resultInfo && paytmResponse.body.resultInfo.resultStatus === 'S') {
        payment.txnToken = paytmResponse.body.txnToken;
        await payment.save();

        res.status(200).json({
          success: true,
          statusCode: 200,
          message: 'Booking payment initiated',
          data: {
            orderId: orderId,
            txnToken: paytmResponse.body.txnToken,
            amount: amount,
            mid: paytmService.mid,
            callbackUrl: paytmService.callbackUrl,
            paymentId: payment._id,
            bookingNumbers: bookings.map(b => b.bookingNumber)
          }
        });
      } else {
        // Revert bookings back to IN_CART
        for (const booking of bookings) {
          booking.bookingStatus = 'IN_CART';
          booking.status = 'in_cart';
          await booking.save();
        }

        payment.paymentStatus = 'TXN_FAILURE';
        payment.gatewayResponse = {
          respCode: paytmResponse.body?.resultInfo?.resultCode,
          respMsg: paytmResponse.body?.resultInfo?.resultMsg
        };
        await payment.save();

        res.status(400).json({
          success: false,
          message: 'Payment initiation failed',
          error: paytmResponse.body?.resultInfo?.resultMsg || 'Unknown error'
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Paytm callback handler
  async paymentCallback(req, res) {
    try {
      const callbackData = req.body;
      const orderId = callbackData.ORDERID;
      const txnStatus = callbackData.STATUS;

      console.log(`Payment callback received for order: ${orderId}, status: ${txnStatus}`);

      const payment = await Payment.findOne({ orderId });
      if (!payment) {
        console.error(`Payment not found for order: ${orderId}`);
        return res.status(404).json({ error: 'Payment not found' });
      }

      // Update payment with gateway response
      payment.paymentStatus = txnStatus;
      payment.transactionId = callbackData.TXNID;
      payment.paymentMode = callbackData.PAYMENTMODE;
      payment.gatewayResponse = {
        txnId: callbackData.TXNID,
        bankTxnId: callbackData.BANKTXNID,
        bankName: callbackData.BANKNAME,
        gatewayName: callbackData.GATEWAYNAME,
        respCode: callbackData.RESPCODE,
        respMsg: callbackData.RESPMSG,
        txnDate: callbackData.TXNDATE
      };
      await payment.save();

      // If payment succeeded, confirm linked booking(s)
      if (txnStatus === 'TXN_SUCCESS' && payment.bookingId) {
        // Find all PENDING bookings for this client that were part of this payment
        const booking = await Booking.findById(payment.bookingId);
        if (booking) {
          // Confirm all PENDING bookings for this client
          await Booking.updateMany(
            {
              'client.id': payment.clientId,
              bookingStatus: 'PENDING'
            },
            {
              bookingStatus: 'CONFIRMED',
              status: 'confirmed',
              'payment.paymentStatus': 'Paid',
              'payment.totalPaid': payment.amount,
              'payment.activePaymentMethods': [{ method: payment.paymentMode || 'UPI', amount: payment.amount }]
            }
          );
          console.log(`Bookings confirmed for client: ${payment.clientId}`);
        }
      } else if (txnStatus === 'TXN_FAILURE' && payment.bookingId) {
        // Revert bookings back to IN_CART on failure
        await Booking.updateMany(
          {
            'client.id': payment.clientId,
            bookingStatus: 'PENDING'
          },
          {
            bookingStatus: 'IN_CART',
            status: 'in_cart'
          }
        );
        console.log(`Bookings reverted to cart for client: ${payment.clientId}`);
      }

      res.status(200).json({
        success: txnStatus === 'TXN_SUCCESS',
        statusCode: 200,
        message: txnStatus === 'TXN_SUCCESS' ? 'Payment successful' : 'Payment failed',
        data: {
          orderId: orderId,
          transactionId: callbackData.TXNID,
          status: txnStatus,
          amount: callbackData.TXNAMOUNT,
          paymentMode: callbackData.PAYMENTMODE
        }
      });
    } catch (error) {
      console.error('Payment callback error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Check payment status and update bookings accordingly
  async getPaymentStatus(req, res) {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }

      // Check with Paytm
      const paytmResponse = await paytmService.getTransactionStatus(orderId);

      // Update local payment record
      const payment = await Payment.findOne({ orderId });
      if (payment && paytmResponse.body) {
        const txnStatus = paytmResponse.body.resultInfo?.resultStatus;
        payment.paymentStatus = txnStatus || payment.paymentStatus;
        payment.transactionId = paytmResponse.body.txnId || payment.transactionId;
        payment.paymentMode = paytmResponse.body.paymentMode || payment.paymentMode;
        payment.gatewayResponse = {
          ...payment.gatewayResponse,
          txnId: paytmResponse.body.txnId,
          bankTxnId: paytmResponse.body.bankTxnId,
          bankName: paytmResponse.body.bankName,
          gatewayName: paytmResponse.body.gatewayName,
          txnDate: paytmResponse.body.txnDate,
        };
        await payment.save();

        // Update booking statuses based on payment result
        if (txnStatus === 'TXN_SUCCESS' && payment.bookingId) {
          await Booking.updateMany(
            { 'client.id': payment.clientId, bookingStatus: 'PENDING' },
            {
              bookingStatus: 'CONFIRMED',
              status: 'confirmed',
              'payment.paymentStatus': 'Paid',
              'payment.totalPaid': payment.amount,
              'payment.activePaymentMethods': [{ method: paytmResponse.body.paymentMode || 'ONLINE', amount: payment.amount }]
            }
          );
          console.log(`Bookings confirmed for client: ${payment.clientId}, order: ${orderId}`);
        } else if (txnStatus === 'TXN_FAILURE' && payment.bookingId) {
          await Booking.updateMany(
            { 'client.id': payment.clientId, bookingStatus: 'PENDING' },
            { bookingStatus: 'IN_CART', status: 'in_cart' }
          );
          console.log(`Bookings reverted to cart for client: ${payment.clientId}, order: ${orderId}`);
        }
      }

      res.json({
        statusCode: 200,
        data: {
          localStatus: payment,
          gatewayStatus: paytmResponse.body
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Search payments
  async searchPayment(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: [
          { path: 'bookingId' },
          { path: 'billId' }
        ]
      };
      const payments = await Payment.paginate(req.body.search || {}, options);
      res.json({ statusCode: 200, data: payments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Get payments by client
  async getPaymentsByClient(req, res) {
    try {
      const { clientId, page = 1, limit = 10 } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: 'clientId is required' });
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: 'bookingId' },
          { path: 'billId' }
        ]
      };

      const payments = await Payment.paginate({ clientId }, options);
      res.json({ statusCode: 200, data: payments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Initiate refund
  async initiateRefund(req, res) {
    try {
      const { orderId, refundAmount, remarks } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: 'orderId is required' });
      }

      const payment = await Payment.findOne({ orderId });
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      if (payment.paymentStatus !== 'TXN_SUCCESS') {
        return res.status(400).json({ error: 'Can only refund successful payments' });
      }

      const amount = refundAmount || payment.amount;
      const refundId = `REFUND_${Date.now()}`;

      const paytmResponse = await paytmService.initiateRefund(
        orderId,
        refundId,
        payment.gatewayResponse.txnId,
        amount
      );

      if (paytmResponse.body && paytmResponse.body.resultInfo && paytmResponse.body.resultInfo.resultStatus === 'TXN_SUCCESS') {
        payment.paymentStatus = 'REFUNDED';
        payment.refundAmount = amount;
        payment.refundId = refundId;
        if (remarks) payment.remarks = remarks;
        await payment.save();

        res.json({
          statusCode: 200,
          message: 'Refund initiated successfully',
          data: {
            orderId,
            refundId,
            refundAmount: amount,
            status: 'REFUNDED'
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Refund failed',
          error: paytmResponse.body?.resultInfo?.resultMsg || 'Unknown error'
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PaymentController();
