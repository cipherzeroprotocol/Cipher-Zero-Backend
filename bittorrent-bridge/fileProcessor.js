const crypto = require('crypto');
const xxhash = require('xxhash');
const { pipeline } = require('stream');
const { promisify } = require('util');
const logger = require('../utils/logger');

class FileProcessor {
    constructor() {
        this.CHUNK_SIZE = 1024 * 1024; // 1MB default chunk size
        this.HASH_ALGORITHM = 'sha256';
    }

    /**
     * Process file for torrent creation
     */
    async processFile(file, options = {}) {
        try {
            const {
                chunkSize = this.CHUNK_SIZE,
                encrypt = false
            } = options;

            // Generate encryption key if needed
            const encryptionKey = encrypt ? await this.generateEncryptionKey() : null;

            // Process file in chunks
            const { chunks, buffer } = await this.processFileChunks(file, {
                chunkSize,
                encryptionKey
            });

            return {
                buffer,
                chunks,
                encryptionKey,
                originalSize: file.size,
                processedSize: buffer.length,
                hash: await this.generateFileHash(buffer)
            };

        } catch (error) {
            logger.error('File processing failed:', error);
            throw error;
        }
    }

    /**
     * Process file in chunks
     */
    async processFileChunks(file, options) {
        const chunks = [];
        const chunkMetadata = [];
        let offset = 0;

        while (offset < file.size) {
            const chunk = file.slice(offset, offset + options.chunkSize);
            
            // Process chunk
            const processedChunk = await this.processChunk(chunk, {
                index: chunks.length,
                encryptionKey: options.encryptionKey
            });

            chunks.push(processedChunk.data);
            chunkMetadata.push({
                index: chunks.length - 1,
                hash: processedChunk.hash,
                size: processedChunk.size,
                iv: processedChunk.iv
            });

            offset += options.chunkSize;
        }

        return {
            buffer: Buffer.concat(chunks),
            chunks: chunkMetadata
        };
    }

    /**
     * Process individual chunk
     */
    async processChunk(chunk, options) {
        try {
            let data = await this.readChunk(chunk);

            // Encrypt if needed
            if (options.encryptionKey) {
                const iv = crypto.randomBytes(16);
                data = await this.encryptChunk(data, options.encryptionKey, iv);
                return {
                    data,
                    hash: this.hashChunk(data),
                    size: data.length,
                    iv
                };
            }

            return {
                data,
                hash: this.hashChunk(data),
                size: data.length
            };

        } catch (error) {
            logger.error('Chunk processing failed:', error);
            throw error;
        }
    }

    /**
     * Read chunk data
     */
    async readChunk(chunk) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(Buffer.from(reader.result));
            reader.onerror = reject;
            reader.readAsArrayBuffer(chunk);
        });
    }

    /**
     * Encrypt chunk
     */
    async encryptChunk(chunk, key, iv) {
        try {
            const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
            const encrypted = Buffer.concat([
                cipher.update(chunk),
                cipher.final()
            ]);
            const authTag = cipher.getAuthTag();

            return Buffer.concat([
                encrypted,
                authTag,
                iv
            ]);

        } catch (error) {
            logger.error('Chunk encryption failed:', error);
            throw error;
        }
    }

    /**
     * Decrypt chunk
     */
    async decryptChunk(chunk, key) {
        try {
            // Extract IV and auth tag from chunk
            const iv = chunk.slice(chunk.length - 16);
            const authTag = chunk.slice(chunk.length - 32, chunk.length - 16);
            const data = chunk.slice(0, chunk.length - 32);

            const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
            decipher.setAuthTag(authTag);

            return Buffer.concat([
                decipher.update(data),
                decipher.final()
            ]);

        } catch (error) {
            logger.error('Chunk decryption failed:', error);
            throw error;
        }
    }

    /**
     * Hash chunk using xxHash for speed
     */
    hashChunk(chunk) {
        return xxhash.hash64(chunk, 0).toString('hex');
    }

    /**
     * Generate file hash
     */
    async generateFileHash(buffer) {
        return crypto
            .createHash(this.HASH_ALGORITHM)
            .update(buffer)
            .digest('hex');
    }

    /**
     * Generate encryption key
     */
    async generateEncryptionKey() {
        return crypto.randomBytes(32);
    }

      /**
     * Decrypt entire file
     */
      async decryptFile(file, encryptionKey) {
        try {
            const chunks = await this.processFileChunks(file, {
                chunkSize: this.CHUNK_SIZE
            });

            const decryptedChunks = await Promise.all(
                chunks.chunks.map(chunk =>
                    this.decryptChunk(chunk.data, encryptionKey)
                )
            );
            
            return Buffer.concat(decryptedChunks);
            
        } catch (error) {
            logger.error('File decryption failed:', error);
            throw error;
        }
    }
}

module.exports = FileProcessor;