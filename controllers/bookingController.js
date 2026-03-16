const Booking = require('../models/Booking');

class BookingController {
  // Add to cart - creates a booking with IN_CART status
  async addToCart(req, res) {
    try {
      const bookingData = {
        ...req.body,
        bookingStatus: 'IN_CART',
        status: 'in_cart'
      };

      const booking = new Booking(bookingData);
      await booking.save();

      res.status(200).json({
        success: true,
        message: 'Added to cart successfully',
        statusCode: 201,
        data: booking
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Get cart items for a client
  async getCart(req, res) {
    try {
      const { clientId } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: 'Client ID is required' });
      }

      const cartItems = await Booking.find({
        'client.id': clientId,
        bookingStatus: 'IN_CART'
      }).sort({ createdAt: -1 });

      res.json({
        statusCode: 200,
        data: cartItems,
        cartCount: cartItems.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Update cart item (change quantity, services, etc.)
  async updateCart(req, res) {
    try {
      const { _id, ...updateData } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      // Block sensitive fields
      const protectedFields = ['bookingStatus', 'status', 'paymentDone', 'payment'];
      for (const field of protectedFields) {
        delete updateData[field];
      }

      const booking = await Booking.findOne({ _id, bookingStatus: 'IN_CART' });
      if (!booking) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      const updated = await Booking.findByIdAndUpdate(_id, updateData, { new: true });
      res.json({ statusCode: 200, data: updated });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Remove item from cart
  async removeFromCart(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      const booking = await Booking.findOneAndRemove({ _id, bookingStatus: 'IN_CART' });
      if (!booking) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      res.json({ statusCode: 200, message: 'Removed from cart successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Clear entire cart for a client
  async clearCart(req, res) {
    try {
      const { clientId } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: 'Client ID is required' });
      }

      const result = await Booking.deleteMany({
        'client.id': clientId,
        bookingStatus: 'IN_CART'
      });

      res.json({
        statusCode: 200,
        message: 'Cart cleared successfully',
        deletedCount: result.deletedCount
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Create booking directly (skip cart)
  async createBooking(req, res) {
    try {
      const bookingData = {
        ...req.body,
        bookingStatus: req.body.bookingStatus || 'CONFIRMED',
        status: req.body.status || 'confirmed'
      };

      const booking = new Booking(bookingData);
      await booking.save();

      res.status(200).json({
        success: true,
        message: 'Booking created successfully',
        statusCode: 201,
        data: booking
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchBooking(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 }
      };
      const bookings = await Booking.paginate(req.body.search, options);

      // Populate client info for bookings that only have client.id
      const clientIds = [...new Set(
        bookings.docs
          .filter(b => (b.client?.id || b.client?._id) && !b.client?.name)
          .map(b => (b.client.id || b.client._id?.toString()))
      )];
      if (clientIds.length > 0) {
        const Client = require('../models/Client');
        const clients = await Client.find({ _id: { $in: clientIds } }, 'name phoneNumber gender customerType');
        const clientMap = {};
        clients.forEach(c => { clientMap[c._id.toString()] = c; });
        bookings.docs = bookings.docs.map(b => {
          const doc = b.toObject ? b.toObject() : b;
          const cid = doc.client?.id || doc.client?._id?.toString();
          if (cid && !doc.client?.name && clientMap[cid]) {
            const c = clientMap[cid];
            doc.client.name = c.name;
            doc.client.phoneNumber = c.phoneNumber;
            doc.client.gender = c.gender;
            doc.client.customerType = c.customerType;
          }
          return doc;
        });
      }

      res.json({ statusCode: 200, data: bookings });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateBooking(req, res) {
    try {
      const { _id, ...updateData } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      // Block sensitive fields that should only be set by payment flow
      const protectedFields = ['bookingStatus', 'status', 'paymentDone', 'payment', 'paymentMode'];
      const attemptedProtected = protectedFields.filter(f => f in updateData);
      if (attemptedProtected.length > 0) {
        return res.status(403).json({
          error: `Cannot update protected fields: ${attemptedProtected.join(', ')}. These are managed by the payment system.`
        });
      }

      const booking = await Booking.findByIdAndUpdate(_id, updateData, { new: true });
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      res.json({ statusCode: 200, data: booking });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteBooking(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }
      const booking = await Booking.findByIdAndRemove(_id);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      res.json({ statusCode: 200, message: 'Booking deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getBookingByNumber(req, res) {
    try {
      const { bookingNumber } = req.body;
      if (!bookingNumber) {
        return res.status(400).json({ error: 'Booking number is required' });
      }

      const booking = await Booking.findOne({ bookingNumber })
        .populate('services.id', 'serviceName')
        .populate('products.id', 'productName brand')
        .populate('services.staff', 'name')
        .populate('products.staff', 'name')
        .populate('assignedStaff', 'name')
        .populate('business.unitId', 'unitName unitCode')
        .populate('createdBy', 'name email')
        .populate('billId');

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      res.json({ statusCode: 200, data: booking });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getBookingsByClient(req, res) {
    try {
      const { clientId, page = 1, limit = 10, bookingStatus } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: 'Client ID is required' });
      }

      const query = { 'client.id': clientId };
      if (bookingStatus) {
        query.bookingStatus = bookingStatus;
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: 'services.id', select: 'serviceName' },
          { path: 'products.id', select: 'productName brand' },
          { path: 'assignedStaff', select: 'name' },
          { path: 'createdBy', select: 'name email' }
        ]
      };

      const bookings = await Booking.paginate(query, options);
      res.json({ statusCode: 200, data: bookings });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async cancelBooking(req, res) {
    try {
      const { _id, reason, cancelledBy } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      const booking = await Booking.findByIdAndUpdate(
        _id,
        {
          bookingStatus: 'CANCELLED',
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledBy: cancelledBy
        },
        { new: true }
      );

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      res.json({
        statusCode: 200,
        message: 'Booking cancelled successfully',
        data: booking
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async rescheduleBooking(req, res) {
    try {
      const { _id, scheduledDate, scheduledTime, bookingDate, bookingTime } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      const existingBooking = await Booking.findById(_id);
      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Mark old booking as rescheduled
      existingBooking.bookingStatus = 'RESCHEDULED';
      existingBooking.status = 'rescheduled';
      await existingBooking.save();

      // Create new booking with updated schedule
      const newBookingData = existingBooking.toObject();
      delete newBookingData._id;
      delete newBookingData.__v;
      delete newBookingData.transactionId;
      delete newBookingData.bookingNumber;
      delete newBookingData.createdAt;
      delete newBookingData.updatedAt;
      delete newBookingData.isAccepted;
      delete newBookingData.acceptedBy;
      delete newBookingData.acceptedAt;

      newBookingData.bookingStatus = 'CONFIRMED';
      newBookingData.status = 'confirmed';
      newBookingData.rescheduledFrom = existingBooking._id;
      if (scheduledDate) newBookingData.scheduledDate = scheduledDate;
      if (scheduledTime) newBookingData.scheduledTime = scheduledTime;
      if (bookingDate) newBookingData.bookingDate = bookingDate;
      if (bookingTime) newBookingData.bookingTime = bookingTime;

      const newBooking = new Booking(newBookingData);
      await newBooking.save();

      res.json({
        statusCode: 200,
        message: 'Booking rescheduled successfully',
        data: newBooking,
        previousBooking: existingBooking._id
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async completeBooking(req, res) {
    try {
      const { _id, billId } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      const updateData = {
        bookingStatus: 'COMPLETED',
        status: 'completed',
        completedAt: new Date()
      };
      if (billId) updateData.billId = billId;

      const booking = await Booking.findByIdAndUpdate(_id, updateData, { new: true });
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      res.json({
        statusCode: 200,
        message: 'Booking completed successfully',
        data: booking
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  async updateServiceStatus(req, res) {
    try {
      const { _id, serviceIndex, action, staffId, latitude, longitude } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }
      if (serviceIndex === undefined || serviceIndex === null) {
        return res.status(400).json({ error: 'Service index is required' });
      }
      if (!action || !['start', 'end'].includes(action)) {
        return res.status(400).json({ error: 'Action must be "start" or "end"' });
      }

      const booking = await Booking.findById(_id);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      if (!booking.services || !booking.services[serviceIndex]) {
        return res.status(400).json({ error: 'Service not found at given index' });
      }

      if (action === 'start') {
        // Check if service can be started based on booking date/time
        const now = new Date();

        if (booking.bookingDate) {
          // Parse booking date (format: YYYY-MM-DD or DD-MM-YYYY or any string date)
          const bookingDateObj = new Date(booking.bookingDate);
          if (!isNaN(bookingDateObj)) {
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);
            const bookingDayStart = new Date(bookingDateObj);
            bookingDayStart.setHours(0, 0, 0, 0);

            if (bookingDayStart > todayStart) {
              return res.status(400).json({
                error: `Service cannot be started before the booking date (${booking.bookingDate})`
              });
            }
          }
        }

        if (booking.bookingTime && booking.bookingDate) {
          // Parse booking time (e.g. "02:00 PM", "14:00", "2:00 PM")
          const timeStr = booking.bookingTime.replace(/\s+/g, '').toUpperCase();
          const match = timeStr.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/);
          if (match) {
            let hours = parseInt(match[1]);
            const mins = parseInt(match[2] || '0');
            const period = match[3];
            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;

            const bookingDateTime = new Date(booking.bookingDate);
            if (!isNaN(bookingDateTime)) {
              bookingDateTime.setHours(hours, mins, 0, 0);
              // Allow starting 30 minutes before booking time
              const earliestStart = new Date(bookingDateTime.getTime() - 30 * 60 * 1000);

              if (now < earliestStart) {
                const diffMins = Math.ceil((earliestStart - now) / 60000);
                return res.status(400).json({
                  error: `Service can be started 30 minutes before booking time (${booking.bookingTime}). Please wait ${diffMins} more minute${diffMins > 1 ? 's' : ''}.`
                });
              }
            }
          }
        }

        booking.services[serviceIndex].isServiceStarted = true;
        booking.services[serviceIndex].serviceStartedAt = new Date();
        booking.services[serviceIndex].serviceStartedBy = staffId || null;
        if (latitude && longitude) {
          booking.services[serviceIndex].serviceStartedLocation = {
            type: 'Point',
            coordinates: [longitude, latitude]
          };
        }
        booking.bookingStatus = 'IN_PROGRESS';
        booking.status = 'in_progress';
      } else {
        booking.services[serviceIndex].isServiceCompleted = true;
        booking.services[serviceIndex].serviceCompletedAt = new Date();

        // Check if all services are completed
        const allCompleted = booking.services.every((s) => s.isServiceCompleted);
        if (allCompleted) {
          booking.bookingStatus = 'COMPLETED';
          booking.status = 'completed';
          booking.completedAt = new Date();
        }
      }

      await booking.save();

      res.json({
        statusCode: 200,
        success: true,
        message: action === 'start' ? 'Service started' : 'Service completed',
        data: booking
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Accept booking (manager acknowledges a new confirmed booking)
  async acceptBooking(req, res) {
    try {
      const { _id, acceptedBy } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      const booking = await Booking.findByIdAndUpdate(
        _id,
        {
          isAccepted: true,
          acceptedAt: new Date(),
          acceptedBy: acceptedBy || null,
        },
        { new: true }
      );

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      res.json({
        statusCode: 200,
        message: 'Booking accepted successfully',
        data: booking,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new BookingController();
