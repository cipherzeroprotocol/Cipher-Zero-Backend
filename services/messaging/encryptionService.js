// encryptionService.js
const crypto = require('crypto');
const { promisify } = require('util');
const logger = require('../../utils/logger');

const randomBytes = promisify(crypto.randomBytes);
const DEFAULT_ALGO = 'aes-256-gcm';

class EncryptionService {
   constructor() {
       this.algorithm = DEFAULT_ALGO;
   }

   /**
    * Encrypt message with AES-GCM
    */
   async encryptMessage(message, key, nonce) {
       try {
           // Create cipher with key and nonce
           const cipher = crypto.createCipheriv(
               this.algorithm,
               key,
               nonce
           );

           // Encrypt message
           const encrypted = Buffer.concat([
               cipher.update(message, 'utf8'),
               cipher.final()
           ]);

           // Get auth tag
           const authTag = cipher.getAuthTag();

           // Return encrypted message, auth tag and nonce
           return {
               encrypted,
               authTag,
               nonce
           };

       } catch (error) {
           logger.error('Message encryption failed:', error);
           throw error;
       }
   }

   /**
    * Decrypt message with AES-GCM
    */
   async decryptMessage(encryptedMessage, key, nonce, authTag) {
       try {
           // Create decipher with key and nonce
           const decipher = crypto.createDecipheriv(
               this.algorithm,
               key,
               nonce
           );

           // Set auth tag
           decipher.setAuthTag(authTag);

           // Decrypt message
           const decrypted = Buffer.concat([
               decipher.update(encryptedMessage),
               decipher.final()
           ]);

           return decrypted.toString('utf8');

       } catch (error) {
           logger.error('Message decryption failed:', error);
           throw error;
       }
   }

   /**
    * Encrypt key with recipient's public key
    */
   async encryptKey(key, recipientPublicKey) {
       try {
           return crypto.publicEncrypt(
               recipientPublicKey,
               key
           );
       } catch (error) {
           logger.error('Key encryption failed:', error);
           throw error;
       }
   }

   /**
    * Decrypt key with recipient's private key
    */
   async decryptKey(encryptedKey, recipientPrivateKey) {
       try {
           return crypto.privateDecrypt(
               recipientPrivateKey,
               encryptedKey
           );
       } catch (error) {
           logger.error('Key decryption failed:', error);
           throw error;
       }
   }

   /**
    * Generate message hash
    */
   hashMessage(message) {
       return crypto.createHash('sha256')
           .update(message)
           .digest();
   }

   /**
    * Generate encryption key
    */
   async generateKey() {
       return randomBytes(32);
   }

   /**
    * Generate nonce
    */
   async generateNonce() {
       return randomBytes(16);
   }

   /**
    * Derive key from password
    */
   async deriveKey(password, salt) {
       return new Promise((resolve, reject) => {
           crypto.pbkdf2(password, salt, 100000, 32, 'sha512', (err, key) => {
               if (err) reject(err);
               resolve(key);
           });
       });
   }

   /**
    * Generate salt
    */
   async generateSalt() {
       return randomBytes(16);
   }
}

module.exports = {
   MessageService,
   EncryptionService
};