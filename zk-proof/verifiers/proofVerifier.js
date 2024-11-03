const snarkjs = require('snarkjs');
const { poseidon } = require('circomlib');
const logger = require('../../utils/logger');

class ProofVerifier {
    constructor() {
        this.verificationKeys = new Map();
        this.verificationCache = new Map();
        this.CACHE_TTL = 3600000; // 1 hour
        this.CIRCUITS = {
            FILE: 'fileProof',
            MESSAGE: 'messagePrivacy',
            TRANSFER: 'tokenPrivacy'
        };
    }

    /**
     * Initialize verifier with verification keys
     */
    async initialize() {
        try {
            // Load verification keys for each circuit
            for (const circuitType of Object.values(this.CIRCUITS)) {
                const vKey = await this.loadVerificationKey(circuitType);
                this.verificationKeys.set(circuitType, vKey);
            }
            
            logger.info('ProofVerifier initialized');
        } catch (error) {
            logger.error('ProofVerifier initialization failed:', error);
            throw error;
        }
    }

    /**
     * Verify proof
     */
    async verifyProof(proofData) {
        try {
            const {
                type,
                proof,
                publicSignals,
                timestamp = Date.now()
            } = proofData;

            // Check cache
            const cacheKey = this.generateCacheKey(proof, publicSignals);
            if (this.verificationCache.has(cacheKey)) {
                return this.verificationCache.get(cacheKey);
            }

            // Get verification key
            const vKey = this.verificationKeys.get(type);
            if (!vKey) {
                throw new Error(`Verification key not found for type: ${type}`);
            }

            // Verify proof
            const isValid = await snarkjs.groth16.verify(
                vKey,
                publicSignals,
                proof
            );

            // Verify timestamp is recent
            const isTimestampValid = this.verifyTimestamp(timestamp);
            if (!isTimestampValid) {
                logger.warn('Proof timestamp verification failed');
                return false;
            }

            // Cache result
            this.cacheVerification(cacheKey, isValid);

            return isValid;

        } catch (error) {
            logger.error('Proof verification failed:', error);
            throw error;
        }
    }

    /**
     * Verify batch proofs
     */
    async verifyBatchProofs(proofs) {
        try {
            const results = await Promise.all(
                proofs.map(async proof => {
                    try {
                        const isValid = await this.verifyProof(proof);
                        return {
                            type: proof.type,
                            isValid,
                            error: null
                        };
                    } catch (error) {
                        return {
                            type: proof.type,
                            isValid: false,
                            error: error.message
                        };
                    }
                })
            );

            return results;

        } catch (error) {
            logger.error('Batch verification failed:', error);
            throw error;
        }
    }

    /**
     * Load verification key for circuit
     */
    async loadVerificationKey(circuitType) {
        try {
            return await fetch(`/verification-keys/${circuitType}.json`)
                .then(r => r.json());
        } catch (error) {
            logger.error(`Failed to load verification key for ${circuitType}:`, error);
            throw error;
        }
    }

    /**
     * Verify proof timestamp
     */
    verifyTimestamp(timestamp) {
        const MAX_AGE = 300000; // 5 minutes
        return Date.now() - timestamp < MAX_AGE;
    }

    /**
     * Generate cache key
     */
    generateCacheKey(proof, publicSignals) {
        return poseidon([
            ...proof.map(x => BigInt(x)),
            ...publicSignals.map(x => BigInt(x))
        ]).toString();
    }

    /**
     * Cache verification result
     */
    cacheVerification(key, result) {
        this.verificationCache.set(key, result);
        setTimeout(() => this.verificationCache.delete(key), this.CACHE_TTL);
    }

    /**
     * Clear verification cache
     */
    clearCache() {
        this.verificationCache.clear();
    }
}

module.exports = new ProofVerifier();