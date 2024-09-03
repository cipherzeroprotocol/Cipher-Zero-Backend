// src/swarmAI.js

const axios = require('axios');

// Configuration for Swarm AI Nodes
const CONFIG = {
    SWARM_AI_NODES: {
        MAINNET: 'https://mainnet-swarmai-node.example.com',
        TESTNET: 'https://testnet-swarmai-node.example.com'
    },
    NETWORK: 'TESTNET', // Change to 'MAINNET' for production
    TIMEOUT: 15000 // Timeout for network requests in milliseconds
};

// Function to analyze data for threats
async function analyzeData(data) {
    try {
        const url = `${CONFIG.SWARM_AI_NODES[CONFIG.NETWORK]}/analyze`;
        const response = await axios.post(url, data, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: CONFIG.TIMEOUT
        });

        console.log('Threat analysis result:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error analyzing data:', error.message);
        throw error;
    }
}

// Function to get threat detection rules
async function getThreatDetectionRules() {
    try {
        const url = `${CONFIG.SWARM_AI_NODES[CONFIG.NETWORK]}/rules`;
        const response = await axios.get(url, {
            timeout: CONFIG.TIMEOUT
        });

        console.log('Threat detection rules:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching threat detection rules:', error.message);
        throw error;
    }
}

// Function to update threat detection rules
async function updateThreatDetectionRules(newRules) {
    try {
        const url = `${CONFIG.SWARM_AI_NODES[CONFIG.NETWORK]}/rules`;
        const response = await axios.put(url, newRules, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: CONFIG.TIMEOUT
        });

        console.log('Updated threat detection rules:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error updating threat detection rules:', error.message);
        throw error;
    }
}

// Function to get threat detection status
async function getDetectionStatus() {
    try {
        const url = `${CONFIG.SWARM_AI_NODES[CONFIG.NETWORK]}/status`;
        const response = await axios.get(url, {
            timeout: CONFIG.TIMEOUT
        });

        console.log('Detection status:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching detection status:', error.message);
        throw error;
    }
}

// Export functions for use in other parts of the application
module.exports = {
    analyzeData,
    getThreatDetectionRules,
    updateThreatDetectionRules,
    getDetectionStatus
};
