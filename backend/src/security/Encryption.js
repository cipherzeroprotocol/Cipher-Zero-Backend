// src/security/encryptionService.js

const crypto = require('crypto');

// Key and IV should be securely stored and managed
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-secret-key'; // Must be 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16 bytes

/**
 * Encrypts data using AES-256-CBC algorithm.
 * @param {string} text - The text to encrypt.
 * @returns {string} - The encrypted text.
 */
const encrypt = (text) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

/**
 * Decrypts data using AES-256-CBC algorithm.
 * @param {string} text - The encrypted text to decrypt.
 * @returns {string} - The decrypted text.
 */
const decrypt = (text) => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};

module.exports = { encrypt, decrypt };
