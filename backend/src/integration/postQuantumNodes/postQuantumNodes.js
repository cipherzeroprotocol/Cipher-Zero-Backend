// src/postQuantumNodes.js

const axios = require('axios');
const { generateKeyPairSync, privateEncrypt, publicDecrypt } = require('crypto');

// Configuration for Post-Quantum Nodes
const CONFIG = {
    POST_QUANTUM_NODES: {
        MAINNET: 'https://mainnet-postquantum-node.example.com',
        TESTNET: 'https://testnet-postquantum-node.example.com'
    },
    NETWORK: 'TESTNET', // Change to 'MAINNET' for production
    TIMEOUT: 15000 // Timeout for network requests in milliseconds
};

// Function to generate a new key pair for encryption/decryption
function generateKeyPair() {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    return { publicKey, privateKey };
}

// Function to encrypt data using a public key
function encryptData(publicKey, data) {
    const buffer = Buffer.from(data, 'utf-8');
    return privateEncrypt(publicKey, buffer).toString('base64');
}

// Function to decrypt data using a private key
function decryptData(privateKey, encryptedData) {
    const buffer = Buffer.from(encryptedData, 'base64');
    return publicDecrypt(privateKey, buffer).toString('utf-8');
}

// Function to interact with Post-Quantum Nodes for key exchange
async function exchangeKeys() {
    try {
        const url = `${CONFIG.POST_QUANTUM_NODES[CONFIG.NETWORK]}/exchange-keys`;
        const { publicKey, privateKey } = generateKeyPair();

        const payload = { publicKey };
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: CONFIG.TIMEOUT
        });

        console.log(`Key exchange result:`, response.data);
        return { privateKey, ...response.data };
    } catch (error) {
        console.error(`Error exchanging keys:`, error.message);
        throw error;
    }
}

// Function to encrypt and send data to the Post-Quantum Node
async function sendEncryptedData(data) {
    try {
        const { publicKey, privateKey } = await exchangeKeys();
        const encryptedData = encryptData(publicKey, data);
        const url = `${CONFIG.POST_QUANTUM_NODES[CONFIG.NETWORK]}/send-encrypted-data`;

        const response = await axios.post(url, { encryptedData }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: CONFIG.TIMEOUT
        });

        console.log(`Encrypted data sent result:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error sending encrypted data:`, error.message);
        throw error;
    }
}

// Function to decrypt received data
async function receiveAndDecryptData(encryptedData) {
    try {
        const { privateKey } = await exchangeKeys();
        const decryptedData = decryptData(privateKey, encryptedData);
        console.log(`Decrypted data:`, decryptedData);
        return decryptedData;
    } catch (error) {
        console.error(`Error decrypting data:`, error.message);
        throw error;
    }
}

// Export functions for use in other parts of the application
module.exports = {
    generateKeyPair,
    encryptData,
    decryptData,
    exchangeKeys,
    sendEncryptedData,
    receiveAndDecryptData
};
