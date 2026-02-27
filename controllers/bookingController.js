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
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      const booking = await Booking.findOne({ _id, bookingStatus: 'IN_CART' });
      if (!booking) {
        return res.status(404).json({ error: 'Cart item not found' });
      }

      const updated = await Booking.findByIdAndUpdate(_id, req.body, { new: true });
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

  // Book from cart - moves IN_CART items to CONFIRMED
  async bookFromCart(req, res) {
    try {
      const { clientId, bookingDate, bookingTime, scheduledDate, scheduledTime, serviceType, address } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: 'Client ID is required' });
      }

      const cartItems = await Booking.find({
        'client.id': clientId,
        bookingStatus: 'IN_CART'
      });

      if (cartItems.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
      }

      const bookedItems = [];
      for (const item of cartItems) {
        item.bookingStatus = 'CONFIRMED';
        item.status = 'confirmed';
        item.bookingDate = bookingDate || new Date().toISOString().split('T')[0];
        item.bookingTime = bookingTime || new Date().toTimeString().split(' ')[0];
        if (scheduledDate) item.scheduledDate = scheduledDate;
        if (scheduledTime) item.scheduledTime = scheduledTime;
        if (serviceType) item.serviceType = serviceType;
        if (address) item.address = address;
        await item.save();
        bookedItems.push(item);
      }

      res.status(200).json({
        success: true,
        message: `${bookedItems.length} booking(s) confirmed successfully`,
        statusCode: 200,
        data: bookedItems
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
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
      res.json({ statusCode: 200, data: bookings });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateBooking(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Booking ID is required' });
      }

      const booking = await Booking.findByIdAndUpdate(_id, req.body, { new: true });
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
      delete newBookingData.transactionId;
      delete newBookingData.bookingNumber;
      delete newBookingData.createdAt;
      delete newBookingData.updatedAt;

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
}

module.exports = new BookingController();
