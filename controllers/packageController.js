const Package = require('../models/Package');
const ChildService = require('../models/ChildService');

class PackageController {
  async createPackage(req, res) {
    try {
      const packages = new Package(req.body);
      await packages.save();
      res.status(200).json({
        success: true,
        message: "package created successfully",
        statusCode: 201,
        data: packages
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async searchPackage(req, res) {
    try {
      const options = {
        page: parseInt(req.body.page) || 1,
        limit: parseInt(req.body.limit) || 10,
        sort: req.body.sort || { createdAt: -1 },
        populate: req.body.populate || [
          { path: 'unitIds', select: 'unitName unitCode' },
          { path: 'createdBy', select: 'name email' },
          { path: 'services', select: 'name' }
        ]
      };
      const packages = await Package.paginate(req.body.search, options);
      res.json({ statusCode: 200, data: packages });
    } catch (error) {
      res.status(500).json({ statusCode: 404, error: error.message });
    }
  }

  async updatePackage(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Package ID is required' });
      }
      
      const packageData = await Package.findByIdAndUpdate(_id, req.body, { new: true });
      if (!packageData) {
        return res.status(404).json({ error: 'Package not found' });
      }
      res.json({ statusCode: 200, data: packageData });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deletePackage(req, res) {
    try {
      const { _id } = req.body;
      if (!_id) {
        return res.status(400).json({ error: 'Package ID is required' });
      }
      const packageData = await Package.findByIdAndRemove(_id);
      if (!packageData) {
        return res.status(404).json({ error: 'Package not found' });
      }
      res.json({ statusCode: 200, message: 'Package deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PackageController();