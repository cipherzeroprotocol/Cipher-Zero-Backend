const crypto = require('crypto'); // Node.js crypto module for encryption
const config = require('../config/default.json'); // Load configuration for encryption keys

class EncryptionManager {
    constructor() {
        this.algorithm = config.encryptionAlgorithm; // Algorithm for encryption
        this.secretKey = crypto.scryptSync(config.encryptionKey, 'salt', 32); // Derive a key from the encryption key
        this.ivLength = 16; // Initialization vector length for AES
    }

    /**
     * Encrypts the given text.
     * 
     * @param {String} text - The plaintext to encrypt.
     * @returns {String} - The encrypted text in hexadecimal format.
     */
    encrypt(text) {
        const iv = crypto.randomBytes(this.ivLength); // Generate a random IV
        const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv); // Create cipher

        let encrypted = cipher.update(text, 'utf8', 'hex'); // Encrypt the text
        encrypted += cipher.final('hex'); // Finalize the encryption

        // Return the IV and encrypted text, concatenated as a single string
        return `${iv.toString('hex')}:${encrypted}`;
    }

    /**
     * Decrypts the given text.
     * 
     * @param {String} encryptedText - The encrypted text to decrypt.
     * @returns {String} - The decrypted plaintext.
     */
    decrypt(encryptedText) {
        const [ivHex, encrypted] = encryptedText.split(':'); // Split the IV and encrypted text
        const iv = Buffer.from(ivHex, 'hex'); // Convert IV from hex to buffer
        const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv); // Create decipher

        let decrypted = decipher.update(encrypted, 'hex', 'utf8'); // Decrypt the text
        decrypted += decipher.final('utf8'); // Finalize the decryption

        return decrypted; // Return the decrypted text
    }
}

module.exports = new EncryptionManager(); // Export a singleton instance of EncryptionManager
