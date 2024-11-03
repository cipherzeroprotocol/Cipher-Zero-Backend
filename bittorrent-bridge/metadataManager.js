const { EventEmitter } = require('events');
const { encryptMetadata, decryptMetadata } = require('../utils/encryption');
const { ProofService } = require('../services/proofService');
const logger = require('../utils/logger');

class MetadataManager extends EventEmitter {
    constructor() {
        super();
        this.proofService = new ProofService();
        this.metadata = new Map();
        this.verifiedPeers = new Set();
    }

    /**
     * Store torrent metadata with encryption
     */
    async storeMetadata(torrentData) {
        try {
            const {
                infoHash,
                metadata,
                isPrivate = true,
                owner,
                encryptionKey
            } = torrentData;

            // Generate proof for metadata storage
            const proof = await this.proofService.generateFileProof({
                fileHash: infoHash,
                metadata,
                owner
            });

            // Encrypt metadata if private
            const encryptedMetadata = isPrivate
                ? await encryptMetadata(metadata, encryptionKey)
                : metadata;

            // Store with additional info
            this.metadata.set(infoHash, {
                encrypted: encryptedMetadata,
                proof,
                isPrivate,
                owner,
                accessList: new Set([owner]),
                timestamp: Date.now(),
                version: 1
            });

            this.emit('metadata:stored', { infoHash, owner });
            return proof;

        } catch (error) {
            logger.error('Metadata storage failed:', error);
            throw error;
        }
    }

    /**
     * Get torrent metadata
     */
    async getMetadata(infoHash, requestor, encryptionKey = null) {
        try {
            const metadataEntry = this.metadata.get(infoHash);
            if (!metadataEntry) {
                throw new Error('Metadata not found');
            }

            // Check access
            if (!this.checkAccess(infoHash, requestor)) {
                throw new Error('Access denied');
            }

            // Decrypt if private
            const decryptedMetadata = metadataEntry.isPrivate
                ? await decryptMetadata(metadataEntry.encrypted, encryptionKey)
                : metadataEntry.encrypted;

            return {
                ...decryptedMetadata,
                isPrivate: metadataEntry.isPrivate,
                owner: metadataEntry.owner,
                timestamp: metadataEntry.timestamp,
                version: metadataEntry.version
            };

        } catch (error) {
            logger.error('Metadata retrieval failed:', error);
            throw error;
        }
    }

    /**
     * Update torrent metadata
     */
    async updateMetadata(updateData) {
        try {
            const {
                infoHash,
                metadata,
                owner,
                encryptionKey
            } = updateData;

            const existingEntry = this.metadata.get(infoHash);
            if (!existingEntry) {
                throw new Error('Metadata not found');
            }

            // Verify ownership
            if (existingEntry.owner !== owner) {
                throw new Error('Not metadata owner');
            }

            // Generate new proof
            const proof = await this.proofService.generateFileProof({
                fileHash: infoHash,
                metadata,
                owner
            });

            // Encrypt updated metadata if private
            const encryptedMetadata = existingEntry.isPrivate
                ? await encryptMetadata(metadata, encryptionKey)
                : metadata;

            // Update entry
            this.metadata.set(infoHash, {
                ...existingEntry,
                encrypted: encryptedMetadata,
                proof,
                version: existingEntry.version + 1,
                timestamp: Date.now()
            });

            this.emit('metadata:updated', { infoHash, owner });
            return proof;

        } catch (error) {
            logger.error('Metadata update failed:', error);
            throw error;
        }
    }

    /**
     * Share metadata with user
     */
    async shareMetadata(shareData) {
        try {
            const { infoHash, owner, recipient } = shareData;

            const metadataEntry = this.metadata.get(infoHash);
            if (!metadataEntry) {
                throw new Error('Metadata not found');
            }

            // Verify ownership
            if (metadataEntry.owner !== owner) {
                throw new Error('Not metadata owner');
            }

            // Add to access list
            metadataEntry.accessList.add(recipient);
            this.emit('metadata:shared', { infoHash, recipient });

        } catch (error) {
            logger.error('Metadata sharing failed:', error);
            throw error;
        }
    }

    /**
     * Revoke metadata access
     */
    async revokeAccess(revokeData) {
        try {
            const { infoHash, owner, recipient } = revokeData;

            const metadataEntry = this.metadata.get(infoHash);
            if (!metadataEntry) {
                throw new Error('Metadata not found');
            }

            // Verify ownership
            if (metadataEntry.owner !== owner) {
                throw new Error('Not metadata owner');
            }

            // Remove from access list
            metadataEntry.accessList.delete(recipient);
            this.emit('metadata:revoked', { infoHash, recipient });

        } catch (error) {
            logger.error('Access revocation failed:', error);
            throw error;
        }
    }

    /**
     * Check metadata access
     */
    checkAccess(infoHash, address) {
        const metadataEntry = this.metadata.get(infoHash);
        if (!metadataEntry) return false;
        
        return !metadataEntry.isPrivate || 
               metadataEntry.accessList.has(address);
    }
}