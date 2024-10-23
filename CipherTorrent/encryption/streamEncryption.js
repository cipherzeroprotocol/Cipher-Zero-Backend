const { Transform } = require('stream');
const crypto = require('crypto');
const { promisify } = require('util');
const logger = require('../../utils/logger');
const events = require('../../api/websocket/events/eventEmitter');
const EventTypes = require('../../api/websocket/events/eventTypes');

const randomBytes = promisify(crypto.randomBytes);

class StreamEncryption {
   constructor() {
       this.algorithm = 'aes-256-gcm';
       this.pendingStreams = new Map();
   }

   /**
    * Create encryption stream
    */
   async createEncryptionStream(fileId) {
       try {
           // Generate encryption key and IV
           const key = await randomBytes(32);
           const iv = await randomBytes(16);

           // Create cipher
           const cipher = crypto.createCipheriv(this.algorithm, key, iv);

           // Create transform stream
           const encryptStream = new Transform({
               transform(chunk, encoding, callback) {
                   // Encrypt chunk
                   const encryptedChunk = cipher.update(chunk);
                   this.push(encryptedChunk);
                   
                   events.emit(EventTypes.FILE.STREAM_PROGRESS, {
                       fileId,
                       bytesProcessed: chunk.length,
                       type: 'encryption'
                   });

                   callback();
               },
               
               flush(callback) {
                   // Push final block
                   this.push(cipher.final());
                   callback();
               }
           });

           // Store stream metadata
           this.pendingStreams.set(fileId, {
               key,
               iv,
               authTag: null, // Set after encryption completes
               timestamp: Date.now()
           });

           // Handle stream completion
           encryptStream.on('end', () => {
               // Get auth tag
               const metadata = this.pendingStreams.get(fileId);
               metadata.authTag = cipher.getAuthTag();
               
               events.emit(EventTypes.FILE.STREAM_COMPLETED, {
                   fileId,
                   type: 'encryption'
               });
           });

           return {
               stream: encryptStream,
               key,
               iv
           };

       } catch (error) {
           logger.error('Create encryption stream failed:', error);
           throw error;
       }
   }

   /**
    * Create decryption stream
    */
   async createDecryptionStream(fileId, key, iv, authTag) {
       try {
           // Create decipher
           const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
           decipher.setAuthTag(authTag);

           // Create transform stream
           const decryptStream = new Transform({
               transform(chunk, encoding, callback) {
                   // Decrypt chunk
                   const decryptedChunk = decipher.update(chunk);
                   this.push(decryptedChunk);

                   events.emit(EventTypes.FILE.STREAM_PROGRESS, {
                       fileId,
                       bytesProcessed: chunk.length, 
                       type: 'decryption'
                   });

                   callback();
               },

               flush(callback) {
                   // Push final block
                   this.push(decipher.final());
                   callback();
               }
           });

           // Handle stream completion
           decryptStream.on('end', () => {
               events.emit(EventTypes.FILE.STREAM_COMPLETED, {
                   fileId,
                   type: 'decryption'
               });
           });

           return decryptStream;

       } catch (error) {
           logger.error('Create decryption stream failed:', error);
           throw error;
       }
   }

   /**
    * Get stream metadata
    */
   getStreamMetadata(fileId) {
       return this.pendingStreams.get(fileId);
   }

   /**
    * Clean up old stream metadata
    */
   cleanup() {
       const MAX_AGE = 1000 * 60 * 60; // 1 hour
       const now = Date.now();

       for (const [fileId, metadata] of this.pendingStreams) {
           if (now - metadata.timestamp > MAX_AGE) {
               this.pendingStreams.delete(fileId);
           }
       }
   }
}

module.exports = {
   ChunkEncryption,
   StreamEncryption
};