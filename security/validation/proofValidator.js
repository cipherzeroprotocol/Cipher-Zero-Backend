const { PublicKey, Connection } = require('@solana/web3.js');
const { verify } = require('snarkjs');
const { VERIFYING_KEY } = require('../config/zkConstants');
const BN = require('bn.js');

class ProofValidator {
    constructor(connection) {
        this.connection = connection;
        this.verifyingKeys = new Map();
        this.proofCache = new Map();
        this.CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
    }

    async validateZkProof(proof, publicInputs, proofType) {
        try {
            // Check cache first
            const cachedResult = this.getCachedProof(proof, publicInputs);
            if (cachedResult !== null) {
                return cachedResult;
            }

            // Get the appropriate verifying key for this proof type
            const verifyingKey = await this.getVerifyingKey(proofType);
            if (!verifyingKey) {
                throw new Error(`No verifying key found for proof type: ${proofType}`);
            }

            // Validate proof structure
            if (!this.validateProofStructure(proof)) {
                throw new Error('Invalid proof structure');
            }

            // Convert inputs to appropriate format
            const formattedInputs = this.formatPublicInputs(publicInputs);

            // Verify the proof
            const verified = await verify(verifyingKey, formattedInputs, proof);

            // Cache the result
            this.cacheProofResult(proof, publicInputs, verified);

            return verified;
        } catch (error) {
            console.error(`Error validating ZK proof: ${error.message}`);
            return false;
        }
    }

    validateProofStructure(proof) {
        // Check if proof has required components
        if (!proof.pi_a || !proof.pi_b || !proof.pi_c) {
            return false;
        }

        // Validate each component's structure
        try {
            // Validate pi_a (should be array of 2 elements)
            if (!Array.isArray(proof.pi_a) || proof.pi_a.length !== 2) {
                return false;
            }

            // Validate pi_b (should be array of 2 arrays, each with 2 elements)
            if (!Array.isArray(proof.pi_b) || proof.pi_b.length !== 2 ||
                !Array.isArray(proof.pi_b[0]) || proof.pi_b[0].length !== 2 ||
                !Array.isArray(proof.pi_b[1]) || proof.pi_b[1].length !== 2) {
                return false;
            }

            // Validate pi_c (should be array of 2 elements)
            if (!Array.isArray(proof.pi_c) || proof.pi_c.length !== 2) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    async getVerifyingKey(proofType) {
        if (this.verifyingKeys.has(proofType)) {
            return this.verifyingKeys.get(proofType);
        }

        try {
            const verifyingKey = await this.loadVerifyingKey(proofType);
            this.verifyingKeys.set(proofType, verifyingKey);
            return verifyingKey;
        } catch (error) {
            console.error(`Error loading verifying key: ${error.message}`);
            return null;
        }
    }

    async loadVerifyingKey(proofType) {
        // Implement loading verifying key from storage or config
        // This would typically load from a secure source
        return VERIFYING_KEY[proofType];
    }

    formatPublicInputs(inputs) {
        return inputs.map(input => {
            if (typeof input === 'string' && input.startsWith('0x')) {
                return new BN(input.slice(2), 16).toString(10);
            }
            return input.toString();
        });
    }

    getCachedProof(proof, publicInputs) {
        const cacheKey = this.generateProofCacheKey(proof, publicInputs);
        const cached = this.proofCache.get(cacheKey);

        if (!cached) {
            return null;
        }

        if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
            this.proofCache.delete(cacheKey);
            return null;
        }

        return cached.verified;
    }

    cacheProofResult(proof, publicInputs, verified) {
        const cacheKey = this.generateProofCacheKey(proof, publicInputs);
        this.proofCache.set(cacheKey, {
            verified,
            timestamp: Date.now()
        });
    }

    generateProofCacheKey(proof, publicInputs) {
        // Create a unique key based on proof and inputs
        return `${JSON.stringify(proof)}_${JSON.stringify(publicInputs)}`;
    }
}
