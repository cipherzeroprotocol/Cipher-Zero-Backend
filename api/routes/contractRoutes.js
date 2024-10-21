// src/api/routes/contractRoutes.js

const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const authMiddleware = require('../middleware/authMiddleware');

// All contract routes require authentication
router.use(authMiddleware);

// Deploy a new contract
router.post('/deploy', contractController.deployContract);

// Interact with a contract
router.post('/interact', contractController.interactWithContract);

// Get contract details
router.get('/:contractAddress', contractController.getContractDetails);

// Get contract events
router.get('/:contractAddress/events', contractController.getContractEvents);

// Get user's contracts
router.get('/user/contracts', contractController.getUserContracts);

// Estimate gas for a contract interaction
router.post('/estimate-gas', contractController.estimateGas);

// Verify a contract on the blockchain explorer
router.post('/verify', contractController.verifyContract);

// Get contract balance
router.get('/:contractAddress/balance', contractController.getContractBalance);

// Transfer ownership of a contract
router.post('/:contractAddress/transfer-ownership', contractController.transferOwnership);

module.exports = router;