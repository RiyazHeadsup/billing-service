const IncentiveProgram = require('../models/IncentiveProgram');

class IncentiveProgramController {
  async createIncentiveProgram(req, res) {
    try {
      const incentiveProgram = new IncentiveProgram(req.body);
      await incentiveProgram.save();
      
      res.status(200).json({
        success: true,
        message: "Incentive program created successfully",
        statusCode: 201,
        data: incentiveProgram
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchIncentiveProgram(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: [
          { path: 'createdBy', select: 'name email' },
          { path: 'unitIds', select: 'unitName unitCode' }
        ]
      };
      const incentivePrograms = await IncentiveProgram.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: incentivePrograms });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updateIncentiveProgram(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'IncentiveProgram ID is required' });
      }
      
      const incentiveProgram = await IncentiveProgram.findByIdAndUpdate(_id, req.body, { new: true });
      if (!incentiveProgram) {
        return res.status(404).json({ error: 'Incentive program not found' });
      }
      res.json({ statusCode: 200, data: incentiveProgram });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteIncentiveProgram(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'IncentiveProgram ID is required' });
      }
      const incentiveProgram = await IncentiveProgram.findByIdAndRemove(_id);
      if (!incentiveProgram) {
        return res.status(404).json({ error: 'Incentive program not found' });
      }
      res.json({ statusCode: 200, message: 'Incentive program deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIncentiveProgramById(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'IncentiveProgram ID is required' });
      }
      
      const incentiveProgram = await IncentiveProgram.findById(_id)
        .populate('createdBy', 'name email')
        .populate('unitIds', 'unitName unitCode');
        
      if (!incentiveProgram) {
        return res.status(404).json({ error: 'Incentive program not found' });
      }
      res.json({ statusCode: 200, data: incentiveProgram });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIncentiveProgramsByUnit(req, res) {
    try {
      const { unitId, status, page = 1, limit = 10 } = req.body;
      if (!unitId) {
        return res.status(400).json({ error: 'Unit ID is required' });
      }
      
      let searchQuery = { unitIds: { $in: [unitId] } };
      if (status) {
        searchQuery.status = status;
      }
      
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: 'createdBy', select: 'name email' },
          { path: 'unitIds', select: 'unitName unitCode' }
        ]
      };
      
      const incentivePrograms = await IncentiveProgram.paginate(searchQuery, options);
      res.json({ statusCode: 200, data: incentivePrograms });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async activateIncentiveProgram(req, res) {
    try {
      const { _id, notes } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'IncentiveProgram ID is required' });
      }
      
      const incentiveProgram = await IncentiveProgram.findByIdAndUpdate(
        _id,
        {
          status: 'active',
          notes: notes
        },
        { new: true }
      );
      
      if (!incentiveProgram) {
        return res.status(404).json({ error: 'Incentive program not found' });
      }
      
      res.json({
        statusCode: 200,
        message: 'Incentive program activated successfully',
        data: incentiveProgram
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async deactivateIncentiveProgram(req, res) {
    try {
      const { _id, freezeReason, notes } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'IncentiveProgram ID is required' });
      }
      
      const incentiveProgram = await IncentiveProgram.findByIdAndUpdate(
        _id,
        {
          status: 'inactive',
          freezeReason: freezeReason,
          notes: notes
        },
        { new: true }
      );
      
      if (!incentiveProgram) {
        return res.status(404).json({ error: 'Incentive program not found' });
      }
      
      res.json({
        statusCode: 200,
        message: 'Incentive program deactivated successfully',
        data: incentiveProgram
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getIncentiveProgramStats(req, res) {
    try {
      const { unitId, status } = req.body;
      
      let matchQuery = {};
      if (unitId) matchQuery.unitIds = { $in: [unitId] };
      if (status) matchQuery.status = status;
      
      const stats = await IncentiveProgram.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgDailyTarget: { $avg: '$dailyTragetIncentive.tragetvalue' },
            avgProductTarget: { $avg: '$productIncentive.tragetvalue' },
            avgMonthlyTarget: { $avg: '$monthlyIncentive.tragetvalue' },
            avgServiceTarget: { $avg: '$serviceIncentive.tragetvalue' }
          }
        },
        {
          $project: {
            status: '$_id',
            count: 1,
            avgDailyTarget: { $round: ['$avgDailyTarget', 2] },
            avgProductTarget: { $round: ['$avgProductTarget', 2] },
            avgMonthlyTarget: { $round: ['$avgMonthlyTarget', 2] },
            avgServiceTarget: { $round: ['$avgServiceTarget', 2] },
            _id: 0
          }
        }
      ]);
      
      const summary = await IncentiveProgram.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalPrograms: { $sum: 1 },
            activePrograms: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            inactivePrograms: {
              $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
            },
            programsWithDailyIncentive: {
              $sum: { $cond: [{ $eq: ['$dailyTragetIncentive.status', true] }, 1, 0] }
            },
            programsWithProductIncentive: {
              $sum: { $cond: [{ $eq: ['$productIncentive.status', true] }, 1, 0] }
            },
            programsWithMonthlyIncentive: {
              $sum: { $cond: [{ $eq: ['$monthlyIncentive.status', true] }, 1, 0] }
            },
            programsWithServiceIncentive: {
              $sum: { $cond: [{ $eq: ['$serviceIncentive.status', true] }, 1, 0] }
            }
          }
        }
      ]);
      
      res.json({
        statusCode: 200,
        data: {
          byStatus: stats,
          summary: summary.length > 0 ? summary[0] : {
            totalPrograms: 0,
            activePrograms: 0,
            inactivePrograms: 0,
            programsWithDailyIncentive: 0,
            programsWithProductIncentive: 0,
            programsWithMonthlyIncentive: 0,
            programsWithServiceIncentive: 0
          }
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new IncentiveProgramController();