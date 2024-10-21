const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger'); // Logger for tracking file processing
const { createTorrentFile } = require('./torrentManager'); // Function to create a .torrent file

/**
 * Process a file for BitTorrent upload.
 * 
 * @param {string} filePath - The path to the file to process.
 * @param {string} uploader - The address of the user uploading the file.
 * @returns {Promise<Object>} - Returns metadata about the uploaded file and .torrent file.
 */
const processFileForUpload = async (filePath, uploader) => {
    try {
        const fileStats = fs.statSync(filePath); // Get file statistics
        const fileHash = await calculateFileHash(filePath); // Calculate the file hash
        const fileName = path.basename(filePath); // Get the file name
        const fileSize = fileStats.size; // Get the file size

        // Create .torrent file
        const torrentFilePath = await createTorrentFile(filePath, uploader);

        // Prepare metadata object
        const fileMetadata = {
            filename: fileName,
            filesize: fileSize,
            filehash: fileHash,
            uploader,
            torrentFilePath,
            uploadedAt: new Date().toISOString(),
        };

        logger.info(`File processed successfully: ${JSON.stringify(fileMetadata)}`); // Log successful processing
        return fileMetadata; // Return file metadata
    } catch (error) {
        logger.error(`Failed to process file: ${error.message}`); // Log any errors
        throw new Error('File processing failed.'); // Throw an error for further handling
    }
};

/**
 * Calculate the SHA-256 hash of a file.
 * 
 * @param {string} filePath - The path to the file to hash.
 * @returns {Promise<string>} - Returns the SHA-256 hash of the file.
 */
const calculateFileHash = async (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);

        stream.on('data', (data) => {
            hash.update(data);
        });

        stream.on('end', () => {
            resolve(hash.digest('hex')); // Return the hash as a hexadecimal string
        });

        stream.on('error', (error) => {
            reject(error); // Handle stream errors
        });
    });
};

module.exports = {
    processFileForUpload,
};
