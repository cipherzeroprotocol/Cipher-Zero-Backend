// /zk-proof/generators/messageProofGenerator.js
const { poseidon } = require('circomlib');
const { generateProof } = require('../utils/proofUtils');
const { encryptMessage } = require('../../utils/encryption');
const logger = require('../../utils/logger');

class MessageProofGenerator {
    constructor(options = {}) {
        this.circuit = 'messagePrivacy';
        this.wasmPath = options.wasmPath || './circuits/messagePrivacy.wasm';
        this.zkeyPath = options.zkeyPath || './circuits/messagePrivacy.zkey';
        this.proofCache = new Map();
        this.CACHE_TTL = 3600000; // 1 hour
    }

    /**
     * Generate proof for private message
     */
    async generateProof(input) {
        try {
            const {
                message,
                sender,
                recipient,
                recipientPubKey,
                roomId = null
            } = input;

            // Check cache
            const cacheKey = this.generateCacheKey(input);
            if (this.proofCache.has(cacheKey)) {
                return this.proofCache.get(cacheKey);
            }

            // Encrypt message
            const {
                encryptedMessage,
                nonce
            } = await encryptMessage(message, recipientPubKey);

            // Prepare witness input
            const witnessInput = {
                messageHash: this.hashMessage(encryptedMessage),
                sender: BigInt(sender),
                recipient: BigInt(recipient),
                nonce: BigInt(nonce),
                roomId: roomId ? BigInt(roomId) : 0n,
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
            this.cacheProof(cacheKey, {
                proof,
                encryptedMessage,
                nonce
            });

            return {
                proof: proof.proof,
                publicSignals: proof.publicSignals,
                commitment: proof.publicSignals[0],
                nullifier: proof.publicSignals[1],
                encryptedMessage,
                nonce
            };

        } catch (error) {
            logger.error('Message proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate batch message proofs
     */
    async generateBatchProofs(messages) {
        try {
            const proofs = await Promise.all(
                messages.map(msg => this.generateProof(msg))
            );

            return {
                proofs,
                commitment: poseidon(proofs.map(p => BigInt(p.commitment))).toString()
            };

        } catch (error) {
            logger.error('Batch proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Hash message content
     */
    hashMessage(message) {
        return poseidon([Buffer.from(message)]);
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
            this.hashMessage(input.message),
            BigInt(input.sender),
            BigInt(input.recipient)
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

module.exports = new MessageProofGenerator();