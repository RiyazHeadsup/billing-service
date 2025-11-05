const express = require('express');
const clientMembershipController = require('../controllers/clientMembershipController');

const router = express.Router();

router.post('/addClientMembership', clientMembershipController.createClientMembership);
router.post('/searchClientMembership', clientMembershipController.searchClientMembership);
router.post('/updateClientMembership', clientMembershipController.updateClientMembership);
router.post('/deleteClientMembership', clientMembershipController.deleteClientMembership);

module.exports = router;