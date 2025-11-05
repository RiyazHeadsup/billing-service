const express = require('express');
const packageController = require('../controllers/packageController');

const router = express.Router();

router.post('/addPackage', packageController.createPackage);
router.post('/searchPackage', packageController.searchPackage);
router.post('/updatePackage', packageController.updatePackage);
router.post('/deletePackage', packageController.deletePackage);

module.exports = router;