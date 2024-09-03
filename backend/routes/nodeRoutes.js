const express = require('express');
const router = express.Router();
const nodeController = require('../controllers/nodeController');

router.get('/metrics/:nodeId', nodeController.getNodeMetrics);

module.exports = router;
