const crypto = require('crypto');
const config = require('../utils/config'); // Assuming your encryption key and algorithm are stored here

/**
 * Encrypts the provided data using AES-256-CBC algorithm.
 * 
 * @param {string} plaintext - The data to encrypt.
 * @returns {string} - The encrypted data in base64 format.
 * @throws {Error} - Throws an error if encryption fails.
 */
const encryptData = (plaintext) => {
    try {
        const cipher = crypto.createCipheriv(config.ENCRYPTION_ALGORITHM, Buffer.from(config.ENCRYPTION_KEY, 'hex'), config.ENCRYPTION_IV);
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    } catch (error) {
        console.error('Encryption failed:', error.message);
        throw new Error('Encryption error');
    }
};

/**
 * Decrypts the provided data using AES-256-CBC algorithm.
 * 
 * @param {string} encryptedData - The data to decrypt (in base64 format).
 * @returns {string} - The decrypted data.
 * @throws {Error} - Throws an error if decryption fails.
 */
const decryptData = (encryptedData) => {
    try {
        const decipher = crypto.createDecipheriv(config.ENCRYPTION_ALGORITHM, Buffer.from(config.ENCRYPTION_KEY, 'hex'), config.ENCRYPTION_IV);
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error.message);
        throw new Error('Decryption error');
    }
};

module.exports = {
    encryptData,
    decryptData
};
