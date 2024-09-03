// src/data/dataStorage.js

const fs = require('fs');
const path = require('path');

// Configuration for data storage
const CONFIG = {
    DATA_DIR: path.join(__dirname, 'collected_data'),
    BACKUP_DIR: path.join(__dirname, 'backup_data'),
    MAX_FILE_SIZE: 10 * 1024 * 1024 // 10 MB file size limit
};

// Ensure directories exist
if (!fs.existsSync(CONFIG.DATA_DIR)) {
    fs.mkdirSync(CONFIG.DATA_DIR);
}

if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
    fs.mkdirSync(CONFIG.BACKUP_DIR);
}

// Function to get a list of all files in a directory
function listFiles(directory) {
    try {
        return fs.readdirSync(directory).filter(file => fs.statSync(path.join(directory, file)).isFile());
    } catch (error) {
        console.error(`Error listing files in ${directory}:`, error.message);
        return [];
    }
}

// Function to get file size
function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch (error) {
        console.error(`Error getting file size for ${filePath}:`, error.message);
        return 0;
    }
}

// Function to move file to backup
function moveFileToBackup(filePath) {
    try {
        const fileName = path.basename(filePath);
        const backupPath = path.join(CONFIG.BACKUP_DIR, fileName);
        fs.renameSync(filePath, backupPath);
        console.log(`File moved to backup: ${backupPath}`);
    } catch (error) {
        console.error(`Error moving file to backup:`, error.message);
    }
}

// Function to store data to a file
function storeData(fileName, data) {
    try {
        const filePath = path.join(CONFIG.DATA_DIR, fileName);

        // Check file size and move to backup if necessary
        if (fs.existsSync(filePath) && getFileSize(filePath) > CONFIG.MAX_FILE_SIZE) {
            moveFileToBackup(filePath);
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Data stored successfully in ${filePath}`);
    } catch (error) {
        console.error(`Error storing data in ${fileName}:`, error.message);
    }
}

// Function to retrieve data from a file
function retrieveData(fileName) {
    try {
        const filePath = path.join(CONFIG.DATA_DIR, fileName);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        } else {
            console.error(`File not found: ${filePath}`);
            return null;
        }
    } catch (error) {
        console.error(`Error retrieving data from ${fileName}:`, error.message);
        return null;
    }
}

// Function to list all stored data files
function listStoredData() {
    return listFiles(CONFIG.DATA_DIR);
}

// Export functions for use in other parts of the application
module.exports = {
    storeData,
    retrieveData,
    listStoredData
};
