// src/storageNodes.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration for Storage Nodes
const CONFIG = {
    STORAGE_NODES: {
        MAINNET: 'https://mainnet-storage-node.example.com',
        TESTNET: 'https://testnet-storage-node.example.com'
    },
    NETWORK: 'TESTNET', // Change to 'MAINNET' for production
    TIMEOUT: 15000, // Timeout for network requests in milliseconds
    LOCAL_STORAGE_PATH: path.join(__dirname, '../local_storage') // Local path to store files
};

// Ensure local storage path exists
if (!fs.existsSync(CONFIG.LOCAL_STORAGE_PATH)) {
    fs.mkdirSync(CONFIG.LOCAL_STORAGE_PATH, { recursive: true });
}

// Function to upload data to Storage Node
async function uploadData(filePath) {
    try {
        const fileData = fs.readFileSync(filePath);
        const url = `${CONFIG.STORAGE_NODES[CONFIG.NETWORK]}/upload`;
        const formData = new FormData();
        formData.append('file', fileData, path.basename(filePath));

        const response = await axios.post(url, formData, {
            headers: formData.getHeaders(),
            timeout: CONFIG.TIMEOUT
        });

        console.log(`Data upload result:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error uploading data:`, error.message);
        throw error;
    }
}

// Function to download data from Storage Node
async function downloadData(fileId, destinationPath) {
    try {
        const url = `${CONFIG.STORAGE_NODES[CONFIG.NETWORK]}/download/${fileId}`;
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: CONFIG.TIMEOUT
        });

        fs.writeFileSync(destinationPath, response.data);
        console.log(`Data downloaded to: ${destinationPath}`);
    } catch (error) {
        console.error(`Error downloading data:`, error.message);
        throw error;
    }
}

// Function to delete data from Storage Node
async function deleteData(fileId) {
    try {
        const url = `${CONFIG.STORAGE_NODES[CONFIG.NETWORK]}/delete/${fileId}`;
        const response = await axios.delete(url, {
            timeout: CONFIG.TIMEOUT
        });

        console.log(`Data deletion result:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error deleting data:`, error.message);
        throw error;
    }
}

// Function to list all files stored in the Storage Node
async function listStoredFiles() {
    try {
        const url = `${CONFIG.STORAGE_NODES[CONFIG.NETWORK]}/list`;
        const response = await axios.get(url, {
            timeout: CONFIG.TIMEOUT
        });

        console.log(`Stored files:`, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error listing stored files:`, error.message);
        throw error;
    }
}

// Export functions for use in other parts of the application
module.exports = {
    uploadData,
    downloadData,
    deleteData,
    listStoredFiles
};
