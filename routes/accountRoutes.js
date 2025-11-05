const express = require('express');
const accountController = require('../controllers/accountController');

const router = express.Router();

router.post('/addAccount', accountController.createAccount);
router.post('/searchAccount', accountController.searchAccount);
router.post('/updateAccount', accountController.updateAccount);
router.post('/deleteAccount', accountController.deleteAccount);

module.exports = router;