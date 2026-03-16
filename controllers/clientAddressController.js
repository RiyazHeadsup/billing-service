const ClientAddress = require('../models/ClientAddress');

class ClientAddressController {
  async addClientAddress(req, res) {
    try {
      const { clientId, address } = req.body;
      if (!clientId || !address) {
        return res.status(400).json({ error: 'clientId and address are required' });
      }

      // If this is marked as default, unset other defaults for this client
      if (req.body.isDefault) {
        await ClientAddress.updateMany(
          { clientId, isDefault: true },
          { isDefault: false }
        );
      }

      const clientAddress = new ClientAddress(req.body);
      await clientAddress.save();

      res.status(200).json({
        success: true,
        message: 'Address added successfully',
        statusCode: 201,
        data: clientAddress
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchClientAddress(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 20,
        sort: req.body.sort || { isDefault: -1, updatedAt: -1 },
        populate: req.body.populate || []
      };
      const results = await ClientAddress.paginate(req.body.search || {}, options);
      res.json({ statusCode: 200, data: results });
    } catch (error) {
      res.status(500).json({ statusCode: 500, error: error.message });
    }
  }

  async updateClientAddress(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Address ID (_id) is required' });
      }

      // If setting as default, unset other defaults for this client
      if (req.body.isDefault) {
        const existing = await ClientAddress.findById(_id);
        if (existing) {
          await ClientAddress.updateMany(
            { clientId: existing.clientId, isDefault: true, _id: { $ne: _id } },
            { isDefault: false }
          );
        }
      }

      const updated = await ClientAddress.findByIdAndUpdate(_id, req.body, { new: true });
      if (!updated) {
        return res.status(404).json({ error: 'Address not found' });
      }

      res.json({ statusCode: 200, data: updated });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteClientAddress(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Address ID (_id) is required' });
      }

      const deleted = await ClientAddress.findByIdAndRemove(_id);
      if (!deleted) {
        return res.status(404).json({ error: 'Address not found' });
      }

      res.json({ statusCode: 200, message: 'Address deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ClientAddressController();
