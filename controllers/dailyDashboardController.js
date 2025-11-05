const DailyDashboard = require('../models/DailyDashboard');
const ChildService = require('../models/ChildService');
const Product = require('../models/Product');
const User = require('../models/User');

const createDashboard = async (req, res) => {
  try {
    const dashboard = new DailyDashboard(req.body);
    await dashboard.save();
    res.status(201).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const searchDashboard = async (req, res) => {
  try {
    const { date, unitId, page = 1, limit = 10 } = req.body;
    const query = {};
    
    if (date) query.date = date;
    if (unitId) query.unitId = unitId;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      populate: [
        { path: 'unitId', select: 'unitName unitCode' },
        { path: 'topServices.serviceId', select: 'serviceName' },
        { path: 'topProducts.productId', select: 'productName' },
        { path: 'staffPerformance.staffId', select: 'name' }
      ]
    };

    const result = await DailyDashboard.paginate(req.body.search, options);
    
    res.status(200).json({
      success: true,
      data: result.docs,
      pagination: {
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
        currentPage: result.page,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const updateDashboard = async (req, res) => {
  try {
    const { _id } = req.body;
    const dashboard = await DailyDashboard.findByIdAndUpdate(
      _id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    res.status(200).json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const deleteDashboard = async (req, res) => {
  try {
    const { _id } = req.body;
    const dashboard = await DailyDashboard.findByIdAndDelete(_id);

    if (!dashboard) {
      return res.status(404).json({
        success: false,
        message: 'Dashboard not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Dashboard deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createDashboard,
  searchDashboard,
  updateDashboard,
  deleteDashboard
};