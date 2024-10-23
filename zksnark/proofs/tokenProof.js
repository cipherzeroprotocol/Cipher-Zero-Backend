const snarkjs = require('snarkjs');
const { poseidon } = require('circomlib');
const logger = require('../../utils/logger');
const { generateNonce } = require('../../security/encryption');

class TokenProofGenerator {
    constructor(wasmFile, zkeyFile, tokenContract) {
        this.wasmFile = wasmFile;        // Path to tokenPrivacy.wasm
        this.zkeyFile = zkeyFile;        // Path to tokenPrivacy.zkey
        this.tokenContract = tokenContract; // Token contract instance
        this.proofCache = new Map();
    }

    /**
     * Generate a proof for a private token transfer
     */
    async generateTokenTransferProof({
        amount,
        sender,
        recipient,
        tokenId,
        maxAmount,
        minAmount
    }) {
        try {
            // Get sender's current balance
            const senderBalance = await this.tokenContract.balanceOf(sender);
            
            // Generate random nonce
            const nonce = await generateNonce();

            // Prepare circuit inputs
            const input = {
                amount: BigInt(amount),
                sender: BigInt(sender),
                recipient: BigInt(recipient),
                tokenId: BigInt(tokenId),
                nonce: BigInt(nonce),
                senderBalance: BigInt(senderBalance),
                maxAmount: BigInt(maxAmount),
                minAmount: BigInt(minAmount)
            };

            // Generate the proof
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                this.wasmFile,
                this.zkeyFile
            );

            // Format proof for solidity verifier
            const solidityProof = this.formatProofForSolidity(proof);

            return {
                proof: solidityProof,
                publicSignals,
                commitment: publicSignals[0],
                nullifier: publicSignals[1]
            };

        } catch (error) {
            logger.error('Token transfer proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate proof for batch transfers
     */
    async generateBatchTransferProof({
        amounts,
        recipients,
        tokenId,
        sender
    }) {
        try {
            const senderBalance = await this.tokenContract.balanceOf(sender);
            const nonces = await Promise.all(
                recipients.map(() => generateNonce())
            );

            // Prepare circuit inputs for batch transfer
            const input = {
                amounts: amounts.map(a => BigInt(a)),
                recipients: recipients.map(r => BigInt(r)),
                nonces: nonces.map(n => BigInt(n)),
                senderBalance: BigInt(senderBalance),
                tokenId: BigInt(tokenId),
                sender: BigInt(sender)
            };

            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                this.batchWasmFile,  // BatchTokenPrivacy circuit
                this.batchZkeyFile
            );

            return {
                proof: this.formatProofForSolidity(proof),
                publicSignals,
                commitments: publicSignals.slice(0, recipients.length),
                totalAmount: publicSignals[recipients.length]
            };

        } catch (error) {
            logger.error('Batch transfer proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Verify a token transfer proof
     */
    async verifyTokenProof(proof, publicSignals) {
        try {
            const cacheKey = this.generateCacheKey(proof, publicSignals);
            
            if (this.proofCache.has(cacheKey)) {
                return this.proofCache.get(cacheKey);
            }

            const verification = await snarkjs.groth16.verify(
                this.verificationKey,
                publicSignals,
                proof
            );

            this.proofCache.set(cacheKey, verification);

            return verification;

        } catch (error) {
            logger.error('Token proof verification failed:', error);
            throw error;
        }
    }

    /**
     * Format proof for Solidity verifier
     */
    formatProofForSolidity(proof) {
        return [
            proof.pi_a[0], proof.pi_a[1],
            proof.pi_b[0][1], proof.pi_b[0][0],
            proof.pi_b[1][1], proof.pi_b[1][0],
            proof.pi_c[0], proof.pi_c[1]
        ];
    }

    generateCacheKey(proof, publicSignals) {
        return poseidon([
            ...proof.map(p => BigInt(p)),
            ...publicSignals.map(s => BigInt(s))
        ]).toString();
    }
}

module.exports = TokenProofGenerator;
