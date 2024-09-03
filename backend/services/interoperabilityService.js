const axios = require('axios');
const config = require('../utils/config');
const { logError } = require('../utils/logger');

/**
 * Connects to different blockchains based on the provided configuration.
 * 
 * @param {string} blockchainName - The name of the blockchain to connect to.
 * @param {object} [options] - Optional parameters for the connection.
 * @returns {Promise<object>} - A promise that resolves to the connection object or error details.
 * @throws {Error} - Throws an error if connection fails.
 */
const connectToBlockchain = async (blockchainName, options = {}) => {
    try {
        // Get blockchain configuration based on the name
        const blockchainConfig = config.BLOCKCHAIN_CONFIG[blockchainName];
        if (!blockchainConfig) {
            throw new Error(`Configuration for blockchain "${blockchainName}" not found.`);
        }

        // Set up the connection parameters
        const url = blockchainConfig.url;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers // Merge any additional headers provided
        };

        // Make a test request to verify connectivity
        const response = await axios.get(`${url}/status`, { headers });

        if (response.status === 200) {
            console.log(`Successfully connected to ${blockchainName}`);
            return { connected: true, data: response.data };
        } else {
            throw new Error(`Failed to connect to ${blockchainName}. Status: ${response.status}`);
        }
    } catch (error) {
        logError('Failed to connect to blockchain:', error.message);
        throw new Error(`Connection error: ${error.message}`);
    }
};

module.exports = {
    connectToBlockchain
};
