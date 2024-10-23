const crypto = require('crypto');
const { promisify } = require('util');
const { generateProof } = require('../../zksnark/proofs/generateProof');
const logger = require('../../utils/logger');
const events = require('../../api/websocket/events/eventEmitter');
const EventTypes = require('../../api/websocket/events/eventTypes');

const randomBytes = promisify(crypto.randomBytes);

class ChunkEncryption {
   constructor(proofService) {
       this.proofService = proofService;
       this.chunkKeys = new Map();
       this.CHUNK_SIZE = 1024 * 1024; // 1MB chunks
       this.algorithm = 'aes-256-gcm';
   }

   /**
    * Encrypt file chunk with proof generation
    */
   async encryptChunk(chunk, chunkIndex, fileId) {
       try {
           // Generate unique key and IV for chunk
           const key = await this.generateChunkKey(chunkIndex, fileId);
           const iv = await randomBytes(16);

           // Create cipher
           const cipher = crypto.createCipheriv(this.algorithm, key, iv);
           
           // Generate ZK proof for chunk encryption
           const proof = await this.generateEncryptionProof(chunk, key, chunkIndex);
           
           // Encrypt chunk
           const encryptedChunk = Buffer.concat([
               cipher.update(chunk),
               cipher.final()
           ]);

           // Get auth tag
           const authTag = cipher.getAuthTag();

           // Store key with metadata
           this.storeChunkKey(fileId, chunkIndex, {
               key,
               iv,
               authTag,
               proof
           });

           events.emit(EventTypes.FILE.CHUNK_ENCRYPTED, {
               fileId,
               chunkIndex,
               size: chunk.length
           });

           return {
               encryptedChunk,
               iv,
               authTag,
               proof
           };

       } catch (error) {
           logger.error('Chunk encryption failed:', error);
           throw error;
       }
   }

   /**
    * Decrypt file chunk with proof verification
    */
   async decryptChunk(encryptedChunk, chunkIndex, fileId) {
       try {
           // Get chunk key and metadata
           const metadata = this.getChunkKey(fileId, chunkIndex);
           if (!metadata) {
               throw new Error('Chunk key not found');
           }

           // Verify encryption proof
           const isValid = await this.proofService.verifyProof(
               metadata.proof,
               'chunk_encryption'
           );
           if (!isValid) {
               throw new Error('Invalid chunk encryption proof');
           }

           // Create decipher
           const decipher = crypto.createDecipheriv(
               this.algorithm,
               metadata.key,
               metadata.iv
           );
           decipher.setAuthTag(metadata.authTag);

           // Decrypt chunk
           const decryptedChunk = Buffer.concat([
               decipher.update(encryptedChunk),
               decipher.final()
           ]);

           events.emit(EventTypes.FILE.CHUNK_DECRYPTED, {
               fileId,
               chunkIndex,
               size: decryptedChunk.length
           });

           return decryptedChunk;

       } catch (error) {
           logger.error('Chunk decryption failed:', error);
           throw error;
       }
   }

   /**
    * Generate encryption proof for chunk
    */
   async generateEncryptionProof(chunk, key, chunkIndex) {
       const input = {
           chunkHash: this.hashChunk(chunk),
           keyHash: this.hashKey(key),
           chunkIndex,
           timestamp: Date.now()
       };

       return this.proofService.generateProof(input, 'chunk_encryption');
   }

   /**
    * Generate unique key for chunk
    */
   async generateChunkKey(chunkIndex, fileId) {
       const seed = Buffer.concat([
           Buffer.from(fileId),
           Buffer.from(chunkIndex.toString()),
           await randomBytes(32)
       ]);

       return crypto.createHash('sha256').update(seed).digest();
   }

   /**
    * Store chunk key and metadata
    */
   storeChunkKey(fileId, chunkIndex, metadata) {
       const key = `${fileId}:${chunkIndex}`;
       this.chunkKeys.set(key, {
           ...metadata,
           timestamp: Date.now()
       });
   }

   /**
    * Get chunk key and metadata
    */
   getChunkKey(fileId, chunkIndex) {
       const key = `${fileId}:${chunkIndex}`;
       return this.chunkKeys.get(key);
   }

   /**
    * Generate hash of chunk
    */
   hashChunk(chunk) {
       return crypto.createHash('sha256').update(chunk).digest();
   }

   /**
    * Generate hash of key
    */
   hashKey(key) {
       return crypto.createHash('sha256').update(key).digest();
   }

   /**
    * Clean up old chunk keys
    */
   cleanup() {
       const MAX_AGE = 1000 * 60 * 60; // 1 hour
       const now = Date.now();

       for (const [key, metadata] of this.chunkKeys) {
           if (now - metadata.timestamp > MAX_AGE) {
               this.chunkKeys.delete(key);
           }
       }
   }
}
