const express = require('express');
const membershipController = require('../controllers/membershipController');

const router = express.Router();

router.post('/addMembership', membershipController.createMembership);
router.post('/searchMembership', membershipController.searchMembership);
router.post('/updateMembership', membershipController.updateMembership);
router.post('/deleteMembership', membershipController.deleteMembership);

module.exports = router;