const axios = require('axios');
const config = require('../utils/config');
const { logError } = require('../utils/logger');

/**
 * Creates and sends a transaction to the specified blockchain.
 * 
 * @param {string} blockchainName - The blockchain to send the transaction to.
 * @param {object} transactionData - The data for the transaction.
 * @returns {Promise<object>} - A promise that resolves with the transaction result.
 * @throws {Error} - Throws an error if the transaction fails.
 */
const sendTransaction = async (blockchainName, transactionData) => {
    try {
        // Get blockchain configuration based on the name
        const blockchainConfig = config.BLOCKCHAIN_CONFIG[blockchainName];
        if (!blockchainConfig) {
            throw new Error(`Configuration for blockchain "${blockchainName}" not found.`);
        }

        // Prepare the request
        const url = blockchainConfig.url;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.API_KEY}`
        };

        // Send the transaction request
        const response = await axios.post(`${url}/transactions`, transactionData, { headers });

        if (response.status === 200) {
            console.log(`Transaction successful on ${blockchainName}`);
            return response.data;
        } else {
            throw new Error(`Transaction failed on ${blockchainName}. Status: ${response.status}`);
        }
    } catch (error) {
        logError('Transaction failed:', error.message);
        throw new Error(`Transaction error: ${error.message}`);
    }
};

/**
 * Verifies the status of a transaction.
 * 
 * @param {string} blockchainName - The blockchain where the transaction was sent.
 * @param {string} transactionId - The ID of the transaction to verify.
 * @returns {Promise<object>} - A promise that resolves with the transaction status.
 * @throws {Error} - Throws an error if the verification fails.
 */
const verifyTransaction = async (blockchainName, transactionId) => {
    try {
        // Get blockchain configuration based on the name
        const blockchainConfig = config.BLOCKCHAIN_CONFIG[blockchainName];
        if (!blockchainConfig) {
            throw new Error(`Configuration for blockchain "${blockchainName}" not found.`);
        }

        // Prepare the request
        const url = blockchainConfig.url;
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.API_KEY}`
        };

        // Send the verification request
        const response = await axios.get(`${url}/transactions/${transactionId}`, { headers });

        if (response.status === 200) {
            console.log(`Transaction ${transactionId} verified on ${blockchainName}`);
            return response.data;
        } else {
            throw new Error(`Verification failed for transaction ${transactionId} on ${blockchainName}. Status: ${response.status}`);
        }
    } catch (error) {
        logError('Transaction verification failed:', error.message);
        throw new Error(`Verification error: ${error.message}`);
    }
};

module.exports = {
    sendTransaction,
    verifyTransaction
};
