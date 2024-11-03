const { poseidon } = require('circomlib');
const { generateProof } = require('../utils/proofUtils');
const { encryptMetadata } = require('../../utils/encryption');
const logger = require('../../utils/logger');

class FileProofGenerator {
    constructor(options = {}) {
        this.circuit = 'fileProof';
        this.wasmPath = options.wasmPath || './circuits/fileProof.wasm';
        this.zkeyPath = options.zkeyPath || './circuits/fileProof.zkey';
        this.proofCache = new Map();
        this.CACHE_TTL = 3600000; // 1 hour
    }

    /**
     * Generate proof for file sharing
     */
    async generateProof(input) {
        try {
            const {
                fileHash,
                metadata,
                owner,
                recipient = null,
                permissions = 'read',
                isEncrypted = true
            } = input;

            // Check cache
            const cacheKey = this.generateCacheKey(input);
            if (this.proofCache.has(cacheKey)) {
                return this.proofCache.get(cacheKey);
            }

            // Prepare witness input
            const witnessInput = {
                fileHash: this.hashToField(fileHash),
                metadataHash: await this.processMetadata(metadata, isEncrypted),
                owner: BigInt(owner),
                recipient: recipient ? BigInt(recipient) : 0n,
                permissions: BigInt(permissions === 'read' ? 1 : 2),
                timestamp: BigInt(Date.now()),
                nullifier: await this.generateNullifier(),
                randomness: await this.generateRandomness()
            };

            // Generate proof
            const proof = await generateProof(
                witnessInput,
                this.wasmPath,
                this.zkeyPath
            );

            // Cache proof
            this.cacheProof(cacheKey, proof);

            return proof;

        } catch (error) {
            logger.error('File proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Process metadata for proof
     */
    async processMetadata(metadata, isEncrypted) {
        try {
            if (isEncrypted) {
                const encryptedMetadata = await encryptMetadata(metadata);
                return this.hashToField(encryptedMetadata);
            }
            return this.hashToField(JSON.stringify(metadata));
        } catch (error) {
            logger.error('Metadata processing failed:', error);
            throw error;
        }
    }

    /**
     * Hash input to field element
     */
    hashToField(input) {
        return poseidon([Buffer.from(input)]);
    }

    /**
     * Generate nullifier
     */
    async generateNullifier() {
        const random = await this.generateRandomness();
        return poseidon([random, BigInt(Date.now())]);
    }

    /**
     * Generate random field element
     */
    async generateRandomness() {
        const buffer = crypto.randomBytes(32);
        return BigInt('0x' + buffer.toString('hex')) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    }

    /**
     * Generate cache key
     */
    generateCacheKey(input) {
        return poseidon([
            this.hashToField(input.fileHash),
            BigInt(input.owner)
        ]).toString();
    }

    /**
     * Cache proof
     */
    cacheProof(key, proof) {
        this.proofCache.set(key, proof);
        setTimeout(() => this.proofCache.delete(key), this.CACHE_TTL);
    }

    /**
     * Clear proof cache
     */
    clearCache() {
        this.proofCache.clear();
    }
}

module.exports = new FileProofGenerator();