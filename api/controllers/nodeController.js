const nodeServices = require('../services/nodeServices'); // Import service to handle node-related operations
const logger = require('../utils/logger'); // Logger utility for error tracking
const { validateNodeId } = require('../middleware/inputValidation'); // Input validation middleware (if needed)

/**
 * Get metrics for a specific node based on the provided nodeId
 * @param {Object} req - The request object, expects params to contain nodeId
 * @param {Object} res - The response object for sending data or error
 */
const getNodeMetrics = async (req, res) => {
    const { nodeId } = req.params;

    // Validate the nodeId parameter (using middleware or inline)
    if (!validateNodeId(nodeId)) {
        return res.status(400).json({ error: 'Invalid nodeId format' });
    }

    try {
        // Fetch node metrics from node services (potentially involving Solana or zk-compression data)
        const metrics = await nodeServices.getNodeMetrics(nodeId);

        // Handle case where no metrics are found for the nodeId
        if (!metrics) {
            return res.status(404).json({ error: `Metrics not found for nodeId: ${nodeId}` });
        }

        // Respond with the metrics in a structured format
        res.status(200).json(metrics);
    } catch (error) {
        // Log the error details (using a logger for better traceability in a production environment)
        logger.error(`Error fetching node metrics for nodeId: ${nodeId} - ${error.message}`);

        // Handle potential error cases (use more specific error codes if needed)
        if (error instanceof SomeSpecificError) {
            return res.status(502).json({ error: 'Failed to connect to node service' });
        }

        // Generic error response
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { getNodeMetrics };
