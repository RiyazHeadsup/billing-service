const express = require('express');
const { controller } = require('../controllers/accountTransactionController');

const router = express.Router();

router.post('/addAccountTransaction', controller.createAccountTransaction);
router.post('/searchAccountTransaction', controller.searchAccountTransaction);
router.post('/updateAccountTransaction', controller.updateAccountTransaction);
router.post('/deleteAccountTransaction', controller.deleteAccountTransaction);

module.exports = router;