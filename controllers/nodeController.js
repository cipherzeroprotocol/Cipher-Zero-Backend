const nodeServices = require('../services/nodeServices'); // Import service to handle node-related operations

const getNodeMetrics = async (req, res) => {
    try {
        const metrics = await nodeServices.getNodeMetrics(req.params.nodeId);
        res.status(200).json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getNodeMetrics };
