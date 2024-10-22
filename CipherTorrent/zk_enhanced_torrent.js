const crypto = require('crypto');
const { performance } = require('perf_hooks');
const { PublicKey } = require('@solana/web3.js');
const { LightSystemProgram } = require('@lightprotocol/stateless.js');
const zkSnark = require('./zksnark/client');
const logger = require('../utils/logger');

class ZKEnhancedTorrent {
    constructor(torrent, privateData, solanaConnection) {
        this.torrent = torrent;
        this.privateData = privateData;
        this.solanaConnection = solanaConnection;
        this.proofCache = new Map();
        this.commitmentCache = new Map();
    }

    /**
     * Generate a secure commitment using Poseidon hash
     */
    async generateCommitment(data) {
        const cacheKey = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
        
        if (this.commitmentCache.has(cacheKey)) {
            return this.commitmentCache.get(cacheKey);
        }

        try {
            // Use Poseidon hash for better ZK circuit compatibility
            const commitment = await LightSystemProgram.poseidonHash(
                Buffer.from(JSON.stringify(data))
            );
            this.commitmentCache.set(cacheKey, commitment);
            return commitment;
        } catch (error) {
            logger.error('Commitment generation failed:', error);
            throw new Error('Failed to generate commitment');
        }
    }

    /**
     * Create a ZK-enhanced torrent with on-chain verification
     */
    async createZKTorrent() {
        const startTime = performance.now();
        try {
            const commitment = await this.generateCommitment(this.torrent);
            
            const { proof, publicSignals } = await zkSnark.generateProof({
                data: this.torrent,
                privateData: this.privateData,
                commitment
            });

            // Store proof verification on Solana
            const verificationTx = await LightSystemProgram.storeProof({
                proof,
                publicSignals,
                commitment
            });
            await this.solanaConnection.confirmTransaction(verificationTx);

            logger.info(`ZK torrent created in ${performance.now() - startTime}ms`);
            return { commitment, proof, publicSignals, verificationTx };
        } catch (error) {
            logger.error('Failed to create ZK torrent:', error);
            throw error;
        }
    }

    /**
     * Generate proof for a specific piece with caching
     */
    async generatePieceProof(pieceIndex) {
        const cacheKey = `piece_${pieceIndex}`;
        
        if (this.proofCache.has(cacheKey)) {
            return this.proofCache.get(cacheKey);
        }

        try {
            const piece = this.torrent.pieces[pieceIndex];
            if (!piece) {
                throw new Error(`Piece ${pieceIndex} not found`);
            }

            const proof = await zkSnark.generateProof({
                piece,
                privateData: this.privateData,
                pieceIndex
            });

            this.proofCache.set(cacheKey, proof);
            return proof;
        } catch (error) {
            logger.error(`Failed to generate proof for piece ${pieceIndex}:`, error);
            throw error;
        }
    }

    /**
     * Batch verify multiple piece proofs efficiently
     */
    async verifyPieceProofs(pieceProofs) {
        try {
            const verificationPromises = pieceProofs.map(({ pieceIndex, proof }) =>
                this.verifyPieceProof(pieceIndex, proof)
            );
            return await Promise.all(verificationPromises);
        } catch (error) {
            logger.error('Batch proof verification failed:', error);
            throw error;
        }
    }

    /**
     * Generate proof of having specific pieces without revealing which ones
     */
    async generateHavePiecesProof() {
        try {
            const havePieces = this.torrent.pieces.map(piece => piece !== null);
            const commitment = await this.generateCommitment(havePieces);

            const { proof, publicSignals } = await zkSnark.generateProof({
                havePieces,
                privateData: this.privateData,
                commitment
            });

            // Store piece availability on Solana
            const tx = await LightSystemProgram.storePieceAvailability({
                proof,
                publicSignals,
                commitment
            });
            await this.solanaConnection.confirmTransaction(tx);

            return { proof, publicSignals, tx };
        } catch (error) {
            logger.error('Failed to generate have pieces proof:', error);
            throw error;
        }
    }

    /**
     * Verify complete file with ZK proof and on-chain validation
     */
    async verifyCompleteFile(proof, publicSignals) {
        try {
            // Verify the ZK proof
            const isValid = await zkSnark.verifyProof(proof, publicSignals);
            if (!isValid) {
                return false;
            }

            // Verify on-chain state
            const onChainVerification = await LightSystemProgram.verifyFileCompletion({
                proof,
                publicSignals
            });

            return onChainVerification;
        } catch (error) {
            logger.error('Complete file verification failed:', error);
            throw error;
        }
    }

    /**
     * Clear proof and commitment caches
     */
    clearCaches() {
        this.proofCache.clear();
        this.commitmentCache.clear();
        logger.info('Caches cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            proofCacheSize: this.proofCache.size,
            commitmentCacheSize: this.commitmentCache.size
        };
    }
}

module.exports = ZKEnhancedTorrent;

// Usage example:
/*
const { Connection } = require('@solana/web3.js');
const connection = new Connection('https://api.devnet.solana.com');

const zkTorrent = new ZKEnhancedTorrent(torrentData, privateData, connection);

async function example() {
    try {
        // Create ZK torrent with on-chain verification
        const { commitment, proof } = await zkTorrent.createZKTorrent();
        
        // Generate and verify piece proofs
        const pieceProof = await zkTorrent.generatePieceProof(0);
        const isValid = await zkTorrent.verifyPieceProof(0, pieceProof);
        
        // Generate proof of having specific pieces
        const havePiecesProof = await zkTorrent.generateHavePiecesProof();
        
        console.log('Torrent created and verified successfully');
    } catch (error) {
        console.error('Error:', error);
    }
}
*/