// /neon-evm/services/proofService.js
const snarkjs = require('snarkjs');
const { poseidon } = require('circomlib');
const { ProofDao } = require('../../mongo-db/dao/proofDao');
const { getCircuitArtifacts } = require('../utils/circuitLoader');
const logger = require('../../utils/logger');

class ProofService {
    constructor() {
        this.proofDao = new ProofDao();
        this.circuits = new Map();
        this.proofCache = new Map();
        this.CACHE_TTL = 3600 * 1000; // 1 hour
        this.BATCH_SIZE = 10;
        this.pendingProofs = new Map();
    }

    /**
     * Initialize proof service with circuits
     */
    async initialize() {
        try {
            // Load circuit artifacts
            const circuits = ['fileSharing', 'messagePrivacy', 'tokenPrivacy', 'ipHiding'];
            for (const circuit of circuits) {
                const artifacts = await getCircuitArtifacts(circuit);
                this.circuits.set(circuit, artifacts);
            }

            logger.info('Proof service initialized');
        } catch (error) {
            logger.error('Proof service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Generate proof for file sharing
     */
    async generateFileProof(input) {
        try {
            const { fileHash, metadata, owner, recipient, permissions } = input;
            
            // Prepare witness input
            const circuitInput = {
                fileHash: this.hashToField(fileHash),
                metadataHash: this.hashMetadata(metadata),
                owner: BigInt(owner),
                recipient: recipient ? BigInt(recipient) : 0n,
                permissions: BigInt(permissions === 'read' ? 1 : 2),
                timestamp: BigInt(Date.now()),
                nullifier: await this.generateNullifier(),
                randomness: await this.generateRandomness()
            };

            // Generate proof
            const { proof, publicSignals } = await this.generateProof(
                'fileSharing',
                circuitInput
            );

            // Store proof
            await this.storeProof({
                type: 'fileSharing',
                input: circuitInput,
                proof,
                publicSignals
            });

            return {
                proof,
                publicSignals,
                commitment: publicSignals[0]
            };

        } catch (error) {
            logger.error('File proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate proof for private messaging
     */
    async generateMessageProof(input) {
        try {
            const { message, sender, recipient, nonce } = input;

            // Prepare witness input
            const circuitInput = {
                messageHash: this.hashToField(message),
                sender: BigInt(sender),
                recipient: BigInt(recipient),
                nonce: BigInt(nonce),
                timestamp: BigInt(Date.now()),
                nullifier: await this.generateNullifier(),
                randomness: await this.generateRandomness()
            };

            // Generate proof
            const { proof, publicSignals } = await this.generateProof(
                'messagePrivacy',
                circuitInput
            );

            // Store proof
            await this.storeProof({
                type: 'messagePrivacy',
                input: circuitInput,
                proof,
                publicSignals
            });

            return {
                proof,
                publicSignals,
                commitment: publicSignals[0],
                nullifier: publicSignals[1]
            };

        } catch (error) {
            logger.error('Message proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate proof for private token transfer
     */
    async generateTransferProof(input) {
        try {
            const { amount, sender, recipient, tokenId } = input;

            // Prepare witness input
            const circuitInput = {
                amount: BigInt(amount),
                sender: BigInt(sender),
                recipient: BigInt(recipient),
                tokenId: BigInt(tokenId),
                timestamp: BigInt(Date.now()),
                nullifier: await this.generateNullifier(),
                randomness: await this.generateRandomness()
            };

            // Generate proof
            const { proof, publicSignals } = await this.generateProof(
                'tokenPrivacy',
                circuitInput
            );

            // Store proof
            await this.storeProof({
                type: 'tokenPrivacy',
                input: circuitInput,
                proof,
                publicSignals
            });

            return {
                proof,
                publicSignals,
                commitment: publicSignals[0],
                nullifier: publicSignals[1]
            };

        } catch (error) {
            logger.error('Transfer proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate batch proofs
     */
    async generateBatchProofs(inputs, type) {
        try {
            const results = [];
            const batch = [];

            for (const input of inputs) {
                batch.push(input);
                
                if (batch.length >= this.BATCH_SIZE) {
                    const batchResults = await Promise.all(
                        batch.map(input => this.generateProofForType(type, input))
                    );
                    results.push(...batchResults);
                    batch.length = 0;
                }
            }

            if (batch.length > 0) {
                const remainingResults = await Promise.all(
                    batch.map(input => this.generateProofForType(type, input))
                );
                results.push(...remainingResults);
            }

            return results;

        } catch (error) {
            logger.error('Batch proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Verify proof
     */
    async verifyProof(type, proof, publicSignals) {
        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(type, proof, publicSignals);
            if (this.proofCache.has(cacheKey)) {
                return this.proofCache.get(cacheKey);
            }

            // Get circuit artifacts
            const circuit = this.circuits.get(type);
            if (!circuit) {
                throw new Error(`Circuit not found for type: ${type}`);
            }

            // Verify proof
            const isValid = await snarkjs.groth16.verify(
                circuit.verificationKey,
                publicSignals,
                proof
            );

            // Cache result
            this.proofCache.set(cacheKey, isValid);
            setTimeout(() => this.proofCache.delete(cacheKey), this.CACHE_TTL);

            return isValid;

        } catch (error) {
            logger.error('Proof verification failed:', error);
            throw error;
        }
    }

    /**
     * Generate proof for specific type
     */
    async generateProofForType(type, input) {
        switch (type) {
            case 'fileSharing':
                return this.generateFileProof(input);
            case 'messagePrivacy':
                return this.generateMessageProof(input);
            case 'tokenPrivacy':
                return this.generateTransferProof(input);
            default:
                throw new Error(`Unknown proof type: ${type}`);
        }
    }

    /**
     * Generate actual proof using snarkjs
     */
    async generateProof(circuitType, input) {
        try {
            const circuit = this.circuits.get(circuitType);
            if (!circuit) {
                throw new Error(`Circuit not found for type: ${circuitType}`);
            }

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                circuit.wasm,
                circuit.zkey
            );

            return { proof, publicSignals };

        } catch (error) {
            logger.error(`Proof generation failed for ${circuitType}:`, error);
            throw error;
        }
    }

    /**
     * Store proof in database
     */
    async storeProof(proofData) {
        try {
            return await this.proofDao.createProof({
                type: proofData.type,
                input: proofData.input,
                proof: proofData.proof,
                publicSignals: proofData.publicSignals,
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error('Proof storage failed:', error);
            throw error;
        }
    }

    /**
     * Utility methods
     */
    async generateNullifier() {
        const random = await this.generateRandomness();
        return poseidon([random, BigInt(Date.now())]);
    }

    async generateRandomness() {
        const buffer = Buffer.alloc(32);
        crypto.randomFillSync(buffer);
        return BigInt('0x' + buffer.toString('hex')) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    }

    hashToField(data) {
        return poseidon([Buffer.from(data)]);
    }

    hashMetadata(metadata) {
        return poseidon([
            Buffer.from(JSON.stringify(metadata))
        ]);
    }

    generateCacheKey(type, proof, publicSignals) {
        return `${type}:${proof}:${publicSignals.join(',')}`;
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.proofCache.clear();
        this.pendingProofs.clear();
    }
}

module.exports = new ProofService();