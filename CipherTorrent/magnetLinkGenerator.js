const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Generates a magnet link for a given file.
 * 
 * @param {Object} fileMetadata - Metadata of the file.
 * @param {string} fileMetadata.filehash - The SHA-256 hash of the file.
 * @param {string} fileMetadata.filename - The name of the file.
 * @param {number} fileMetadata.filesize - The size of the file in bytes.
 * @returns {string} - The generated magnet link.
 */
const generateMagnetLink = (fileMetadata) => {
    const { filehash, filename, filesize } = fileMetadata;

    // Construct the magnet link
    const magnetLink = `magnet:?xt=urn:btih:${filehash}&dn=${encodeURIComponent(filename)}&xl=${filesize}`;

    logger.info(`Generated magnet link for file: ${filename}`); // Log the generated magnet link
    return magnetLink; // Return the magnet link
};

/**
 * Generate a magnet link for a file given its hash and metadata.
 * 
 * @param {string} filehash - The SHA-256 hash of the file.
 * @param {string} filename - The name of the file.
 * @param {number} filesize - The size of the file in bytes.
 * @returns {string} - The generated magnet link.
 */
const generateMagnetLinkForFile = (filehash, filename, filesize) => {
    const fileMetadata = {
        filehash,
        filename,
        filesize,
    };

    return generateMagnetLink(fileMetadata); // Call the main function to generate the magnet link
};

module.exports = {
    generateMagnetLink,
    generateMagnetLinkForFile,
};
