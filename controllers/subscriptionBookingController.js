const Booking = require('../models/Booking');
const ClientSubscription = require('../models/ClientSubscription');
const SubscriptionTransaction = require('../models/SubscriptionTransaction');

const bookWithSubscription = async (req, res) => {
  try {
    const {
      clientId,
      clientSubscriptionId, // single sub (backward compat)
      services,
      unitId,
      bookingDate,
      bookingTime,
      serviceType,
      address,
    } = req.body;

    if (!clientId || !services?.length) {
      return res.status(400).json({
        success: false,
        type: 'VALIDATION_ERROR',
        error: 'clientId and services are required',
      });
    }

    // Group services by subscriptionId (from cart — each item has subscriptionId assigned by client)
    const subGroups = {};
    for (const svc of services) {
      const subId = svc.subscriptionId || clientSubscriptionId;
      if (!subId) {
        return res.status(400).json({
          success: false,
          type: 'VALIDATION_ERROR',
          error: `Service "${svc.name}" has no subscription assigned. Please select a plan.`,
        });
      }
      if (!subGroups[subId]) subGroups[subId] = [];
      subGroups[subId].push(svc);
    }

    // Validate each subscription and check limits
    const validatedSubs = {};

    for (const [subId, subServices] of Object.entries(subGroups)) {
      const clientSub = await ClientSubscription.findById(subId);

      if (!clientSub) {
        return res.status(404).json({
          success: false,
          type: 'NOT_FOUND',
          error: 'Subscription not found. Please purchase a subscription.',
        });
      }

      if (clientSub.status !== 'active') {
        return res.status(400).json({
          success: false,
          type: 'INACTIVE',
          error: `Your subscription "${clientSub.planName}" is ${clientSub.status}. Please renew or purchase a new plan.`,
          planName: clientSub.planName,
          status: clientSub.status,
        });
      }

      if (String(clientSub.clientId) !== String(clientId)) {
        return res.status(403).json({
          success: false,
          type: 'FORBIDDEN',
          error: 'This subscription does not belong to your account.',
        });
      }

      if (clientSub.endDate && new Date(clientSub.endDate) < new Date()) {
        return res.status(400).json({
          success: false,
          type: 'EXPIRED',
          error: `Your "${clientSub.planName}" subscription expired on ${new Date(clientSub.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`,
          planName: clientSub.planName,
          expiredOn: clientSub.endDate,
        });
      }

      const requested = subServices.reduce((sum, s) => sum + (s.freeQty || s.quantity || 1), 0);
      const alreadyUsed = clientSub.totalServicesUsed || 0;
      const allowed = clientSub.totalServicesAllowed;
      const remaining = allowed === -1 ? -1 : Math.max(0, allowed - alreadyUsed);

      if (allowed !== -1 && requested > remaining) {
        return res.status(400).json({
          success: false,
          type: 'LIMIT_EXCEEDED',
          error: remaining === 0
            ? `You have used all ${allowed} services in your "${clientSub.planName}" plan.`
            : `"${clientSub.planName}" has only ${remaining} free service(s) left but ${requested} requested.`,
          planName: clientSub.planName,
          allowed,
          used: alreadyUsed,
          remaining,
          requested,
        });
      }

      validatedSubs[subId] = { clientSub, requested, subServices };
    }

    // --- Create one booking per subscription ---
    const bookings = [];
    const subscriptionResults = [];
    let totalSavings = 0;
    let totalBooked = 0;

    for (const [subId, { clientSub, requested, subServices }] of Object.entries(validatedSubs)) {
      const bookingServices = subServices.map((svc) => {
        const qty = svc.freeQty || svc.quantity || 1;
        return {
          id: svc.id,
          name: svc.name,
          img: svc.img || '',
          quantity: qty,
          freeQty: qty,
          paidQty: 0,
          coveredBySubscription: true,
          subscriptionId: subId,
          subscriptionName: clientSub.planName,
          pricing: {
            basePrice: svc.pricing?.basePrice || 0,
            finalPrice: 0,
            totalPrice: 0,
            totalBasePrice: (svc.pricing?.basePrice || 0) * qty,
            savings: (svc.pricing?.basePrice || 0) * qty,
          },
        };
      });

      const planSavings = bookingServices.reduce((sum, s) => sum + s.pricing.savings, 0);
      const planBooked = bookingServices.reduce((sum, s) => sum + s.freeQty, 0);
      totalSavings += planSavings;
      totalBooked += planBooked;

      const booking = new Booking({
        client: { id: clientId },
        unitId: unitId || null,
        bookingType: 'APP',
        bookingStatus: 'CONFIRMED',
        status: 'confirmed',
        paymentDone: true,
        bookingDate,
        bookingTime,
        serviceType: serviceType || 'athome',
        address: address?._id || address || undefined,
        services: bookingServices,
        calculations: {
          items: {
            services: {
              count: bookingServices.length,
              baseTotal: planSavings,
              finalTotal: 0,
              totalDiscount: planSavings,
            },
          },
          totals: {
            totalItems: bookingServices.length,
            subtotalBeforeDiscount: planSavings,
            grandTotal: 0,
            finalAmount: 0,
            subscriptionSavings: planSavings,
          },
        },
        payment: {
          paymentStatus: 'Paid',
          totalPaid: 0,
          activePaymentMethods: [{ method: 'SUBSCRIPTION', amount: 0 }],
        },
      });
      await booking.save();

      // Deduct usage
      const updatedSub = await ClientSubscription.findByIdAndUpdate(
        subId,
        { $inc: { totalServicesUsed: requested } },
        { new: true }
      );

      // Create transactions
      for (const svc of bookingServices) {
        await SubscriptionTransaction.create({
          clientSubscriptionId: clientSub._id,
          clientId: clientSub.clientId,
          subscriptionId: clientSub.subscriptionId,
          type: 'service',
          serviceId: svc.id,
          serviceName: svc.name,
          bookingId: booking._id,
          servicePrice: svc.pricing.basePrice,
          discountApplied: svc.pricing.savings,
          freeQty: svc.freeQty,
          unitId: unitId || null,
          status: 'completed',
          remarks: `Redeemed ${svc.freeQty}x ${svc.name} via ${clientSub.planName}`,
        });
      }

      const newRemaining = updatedSub.totalServicesAllowed === -1
        ? 'unlimited'
        : Math.max(0, updatedSub.totalServicesAllowed - updatedSub.totalServicesUsed);

      bookings.push({
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        planName: clientSub.planName,
        servicesBooked: planBooked,
        savings: planSavings,
      });

      subscriptionResults.push({
        planName: clientSub.planName,
        servicesUsed: requested,
        allowed: updatedSub.totalServicesAllowed,
        used: updatedSub.totalServicesUsed,
        remaining: newRemaining,
      });
    }

    res.status(201).json({
      success: true,
      statusCode: 201,
      message: `${bookings.length} booking${bookings.length > 1 ? 's' : ''} confirmed`,
      data: {
        bookings,
        servicesBooked: totalBooked,
        totalSavings,
        subscriptions: subscriptionResults,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      type: 'SERVER_ERROR',
      error: error.message,
    });
  }
};

module.exports = { bookWithSubscription };
