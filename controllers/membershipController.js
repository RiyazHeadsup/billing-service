const Membership = require('../models/Membership');
const Unit = require('../models/Unit');

class MembershipController {
  async createMembership(req, res) {
    try {
      const membership = new Membership(req.body);
      await membership.save();
      res.status(200).json({
        success: true,
        message: "membership created successfully",
        statusCode: 201,
        data: membership
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchMembership(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: req.body.populate || [
          { path: 'unitIds', select: 'unitName unitCode' },
          { path: 'createdBy', select: 'name email' }
        ]
      };
      const memberships = await Membership.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: memberships });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateMembership(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Membership ID is required' });
      }
      
      const membership = await Membership.findByIdAndUpdate(_id, req.body, { new: true });
      if (!membership) {
        return res.status(404).json({ error: 'Membership not found' });
      }
      res.json({ statusCode: 200, data: membership });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteMembership(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Membership ID is required' });
      }
      const membership = await Membership.findByIdAndRemove(_id);
      if (!membership) {
        return res.status(404).json({ error: 'Membership not found' });
      }
      res.json({ statusCode: 200, message: 'Membership deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new MembershipController();