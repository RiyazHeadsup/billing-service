const express = require('express');
const clientAddressController = require('../controllers/clientAddressController');

const router = express.Router();

router.post('/addClientAddress', clientAddressController.addClientAddress);
router.post('/searchClientAddress', clientAddressController.searchClientAddress);
router.post('/updateClientAddress', clientAddressController.updateClientAddress);
router.post('/deleteClientAddress', clientAddressController.deleteClientAddress);

module.exports = router;
