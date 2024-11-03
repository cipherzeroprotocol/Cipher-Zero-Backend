// /zk-proof/generators/transferProofGenerator.js
const { poseidon } = require('circomlib');
const { generateProof } = require('../utils/proofUtils');
const logger = require('../../utils/logger');

class TransferProofGenerator {
    constructor(options = {}) {
        this.circuit = 'tokenPrivacy';
        this.wasmPath = options.wasmPath || './circuits/tokenPrivacy.wasm';
        this.zkeyPath = options.zkeyPath || './circuits/tokenPrivacy.zkey';
        this.proofCache = new Map();
        this.CACHE_TTL = 3600000; // 1 hour
        this.MIN_AMOUNT = BigInt(1);
        this.MAX_AMOUNT = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');
    }

    /**
     * Generate proof for private transfer
     */
    async generateProof(input) {
        try {
            const {
                amount,
                sender,
                recipient,
                tokenId,
                senderBalance
            } = input;

            // Validate transfer amount
            if (!this.isValidAmount(amount)) {
                throw new Error('Invalid transfer amount');
            }

            // Check sufficient balance
            if (BigInt(senderBalance) < BigInt(amount)) {
                throw new Error('Insufficient balance');
            }

            // Check cache
            const cacheKey = this.generateCacheKey(input);
            if (this.proofCache.has(cacheKey)) {
                return this.proofCache.get(cacheKey);
            }

            // Prepare witness input
            const witnessInput = {
                amount: BigInt(amount),
                sender: BigInt(sender),
                recipient: BigInt(recipient),
                tokenId: BigInt(tokenId),
                senderBalance: BigInt(senderBalance),
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

            return {
                proof: proof.proof,
                publicSignals: proof.publicSignals,
                commitment: proof.publicSignals[0],
                nullifier: proof.publicSignals[1]
            };

        } catch (error) {
            logger.error('Transfer proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate batch transfer proofs
     */
    async generateBatchProofs(transfers) {
        try {
            // Validate total transfer amount
            const totalAmount = transfers.reduce(
                (sum, t) => sum + BigInt(t.amount),
                BigInt(0)
            );

            if (!this.isValidAmount(totalAmount)) {
                throw new Error('Invalid total transfer amount');
            }

            const proofs = await Promise.all(
                transfers.map(transfer => this.generateProof(transfer))
            );

            return {
                proofs,
                commitment: poseidon(proofs.map(p => BigInt(p.commitment))).toString(),
                totalAmount: totalAmount.toString()
            };

        } catch (error) {
            logger.error('Batch proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Validate transfer amount
     */
    isValidAmount(amount) {
        const bigAmount = BigInt(amount);
        return bigAmount >= this.MIN_AMOUNT && bigAmount <= this.MAX_AMOUNT;
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
            BigInt(input.amount),
            BigInt(input.sender),
            BigInt(input.recipient),
            BigInt(input.tokenId)
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

module.exports = new TransferProofGenerator();