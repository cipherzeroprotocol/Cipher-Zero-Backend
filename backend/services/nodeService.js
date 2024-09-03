const axios = require('axios');
const config = require('../utils/config');
const { logError } = require('../utils/logger');

/**
 * Interacts with a specific type of node based on the provided node type and action.
 * 
 * @param {string} nodeType - The type of node (e.g., Validator, DataScan).
 * @param {object} actionData - Data needed for the node action.
 * @returns {Promise<object>} - A promise that resolves with the node's response.
 * @throws {Error} - Throws an error if the interaction fails.
 */
const interactWithNode = async (nodeType, actionData) => {
    try {
        // Get node configuration based on the type
        const nodeConfig = config.NODE_CONFIG[nodeType];
        if (!nodeConfig) {
            throw new Error(`Configuration for node type "${nodeType}" not found.`);
        }

        // Prepare the request
        const url = nodeConfig.url;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.API_KEY}`
        };

        // Send the request to the node
        const response = await axios.post(`${url}/action`, actionData, { headers });

        if (response.status === 200) {
            console.log(`Node interaction successful for ${nodeType}`);
            return response.data;
        } else {
            throw new Error(`Node interaction failed for ${nodeType}. Status: ${response.status}`);
        }
    } catch (error) {
        logError('Node interaction failed:', error.message);
        throw new Error(`Node interaction error: ${error.message}`);
    }
};

/**
 * Retrieves the status of a specific node.
 * 
 * @param {string} nodeType - The type of node (e.g., Validator, DataScan).
 * @returns {Promise<object>} - A promise that resolves with the node status.
 * @throws {Error} - Throws an error if the status retrieval fails.
 */
const getNodeStatus = async (nodeType) => {
    try {
        // Get node configuration based on the type
        const nodeConfig = config.NODE_CONFIG[nodeType];
        if (!nodeConfig) {
            throw new Error(`Configuration for node type "${nodeType}" not found.`);
        }

        // Prepare the request
        const url = nodeConfig.url;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.API_KEY}`
        };

        // Send the request to retrieve the status
        const response = await axios.get(`${url}/status`, { headers });

        if (response.status === 200) {
            console.log(`Node status retrieved for ${nodeType}`);
            return response.data;
        } else {
            throw new Error(`Failed to retrieve status for ${nodeType}. Status: ${response.status}`);
        }
    } catch (error) {
        logError('Node status retrieval failed:', error.message);
        throw new Error(`Node status error: ${error.message}`);
    }
};

module.exports = {
    interactWithNode,
    getNodeStatus
};
