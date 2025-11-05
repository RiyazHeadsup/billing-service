const express = require('express');
const incentiveProgramController = require('../controllers/incentiveProgramController');

const router = express.Router();

// Basic CRUD routes
router.post('/addIncentiveProgram', incentiveProgramController.createIncentiveProgram);
router.post('/searchIncentiveProgram', incentiveProgramController.searchIncentiveProgram);
router.post('/updateIncentiveProgram', incentiveProgramController.updateIncentiveProgram);
router.post('/deleteIncentiveProgram', incentiveProgramController.deleteIncentiveProgram);

// Additional functionality routes
router.post('/getIncentiveProgramById', incentiveProgramController.getIncentiveProgramById);
router.post('/getIncentiveProgramsByUnit', incentiveProgramController.getIncentiveProgramsByUnit);
router.post('/activateIncentiveProgram', incentiveProgramController.activateIncentiveProgram);
router.post('/deactivateIncentiveProgram', incentiveProgramController.deactivateIncentiveProgram);
router.post('/getIncentiveProgramStats', incentiveProgramController.getIncentiveProgramStats);

module.exports = router;