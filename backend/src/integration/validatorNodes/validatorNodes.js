// src/validatorNodes.js

const axios = require('axios');

// Configuration for Validator Nodes
const CONFIG = {
    VALIDATOR_NODES: {
        MAINNET: 'https://mainnet-validator-node.example.com',
        TESTNET: 'https://testnet-validator-node.example.com'
    },
    NETWORK: 'TESTNET', // Change to 'MAINNET' for production
    TIMEOUT: 15000 // Timeout for network requests in milliseconds
};

// Function to submit a transaction for validation
async function submitTransaction(transaction) {
    try {
        const url = `${CONFIG.VALIDATOR_NODES[CONFIG.NETWORK]}/submit-transaction`;
        const response = await axios.post(url, transaction, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: CONFIG.TIMEOUT
        });

        console.log('Transaction submission result:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error submitting transaction:', error.message);
        throw error;
    }
}

// Function to get the status of a transaction
async function getTransactionStatus(transactionId) {
    try {
        const url = `${CONFIG.VALIDATOR_NODES[CONFIG.NETWORK]}/transaction-status/${transactionId}`;
        const response = await axios.get(url, {
            timeout: CONFIG.TIMEOUT
        });

        console.log('Transaction status:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching transaction status:', error.message);
        throw error;
    }
}

// Function to get the list of validators
async function getValidators() {
    try {
        const url = `${CONFIG.VALIDATOR_NODES[CONFIG.NETWORK]}/validators`;
        const response = await axios.get(url, {
            timeout: CONFIG.TIMEOUT
        });

        console.log('List of validators:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching list of validators:', error.message);
        throw error;
    }
}

// Function to get validator performance metrics
async function getValidatorMetrics(validatorId) {
    try {
        const url = `${CONFIG.VALIDATOR_NODES[CONFIG.NETWORK]}/validator-metrics/${validatorId}`;
        const response = await axios.get(url, {
            timeout: CONFIG.TIMEOUT
        });

        console.log('Validator performance metrics:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching validator metrics:', error.message);
        throw error;
    }
}

// Export functions for use in other parts of the application
module.exports = {
    submitTransaction,
    getTransactionStatus,
    getValidators,
    getValidatorMetrics
};
