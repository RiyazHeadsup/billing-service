const { getAvailability, SlotError } = require('../services/slotService');

// Body: { unitId, date: 'YYYY-MM-DD', serviceIds: [], staffId? }
// Public through the gateway's /public/getAvailableSlots.
const getAvailableSlots = async (req, res) => {
  try {
    const { unitId, date, serviceIds, staffId } = req.body;
    const data = await getAvailability({ unitId, date, serviceIds, staffId });
    res.json({ success: true, statusCode: 200, data });
  } catch (error) {
    if (error instanceof SlotError) {
      return res.status(error.status).json({ success: false, statusCode: error.status, message: error.message, code: error.code });
    }
    console.error('[getAvailableSlots]', error);
    res.status(500).json({ success: false, statusCode: 500, message: 'Error fetching slots' });
  }
};

module.exports = { getAvailableSlots };
