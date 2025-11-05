const ClientMembership = require('../models/ClientMembership');

class ClientMembershipController {
  async createClientMembership(req, res) {
    try {
      const clientMembership = new ClientMembership(req.body);
      await clientMembership.save();
      res.status(200).json({
        success: true,
        message: "client membership created successfully",
        statusCode: 201,
        data: clientMembership
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchClientMembership(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: req.body.populate || [
          { path: 'clientId'},
          { path: 'membershipId' },
          { path: 'purchasedBy' }
        ]
      };
      const clientMemberships = await ClientMembership.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: clientMemberships });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateClientMembership(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Client Membership ID is required' });
      }
      
      const clientMembership = await ClientMembership.findByIdAndUpdate(_id, req.body, { new: true });
      if (!clientMembership) {
        return res.status(404).json({ error: 'Client Membership not found' });
      }
      res.json({ statusCode: 200, data: clientMembership });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteClientMembership(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Client Membership ID is required' });
      }
      const clientMembership = await ClientMembership.findByIdAndRemove(_id);
      if (!clientMembership) {
        return res.status(404).json({ error: 'Client Membership not found' });
      }
      res.json({ statusCode: 200, message: 'Client Membership deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ClientMembershipController();