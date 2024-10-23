// messageProof.js
const { poseidon } = require('circomlib');
const snarkjs = require('snarkjs');
const logger = require('../../utils/logger');
const { encryptMessage, generateNonce } = require('../../security/encryption');

class MessageProofGenerator {
    constructor(wasmFile, zkeyFile) {
        this.wasmFile = wasmFile;       // Path to messagePrivacy.wasm
        this.zkeyFile = zkeyFile;       // Path to messagePrivacy.zkey
        this.proofCache = new Map();    // Cache for proof verification
    }

    /**
     * Generate a proof for a private message
     */
    async generateMessageProof({
        message,
        sender,
        recipient,
        recipientPubKey,
        timestamp = Date.now()
    }) {
        try {
            // Convert message to bytes32 array
            const messageBytes = Buffer.from(message).toString('hex').padEnd(64, '0');
            const messageArray = Array.from(Buffer.from(messageBytes, 'hex'));

            // Generate random nonce
            const nonce = await generateNonce();

            // Encrypt message for recipient
            const encryptedMessage = await encryptMessage(message, recipientPubKey);

            // Prepare circuit inputs
            const input = {
                message: messageArray,
                sender: BigInt(sender),
                recipient: BigInt(recipient),
                timestamp: BigInt(timestamp),
                nonce: BigInt(nonce),
                recipientPubKey: BigInt(recipientPubKey)
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
                encryptedMessage,
                commitment: publicSignals[0],
                nullifier: publicSignals[1]
            };

        } catch (error) {
            logger.error('Message proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Verify a message proof
     */
    async verifyMessageProof(proof, publicSignals) {
        try {
            const cacheKey = this.generateCacheKey(proof, publicSignals);
            
            // Check cache first
            if (this.proofCache.has(cacheKey)) {
                return this.proofCache.get(cacheKey);
            }

            const verification = await snarkjs.groth16.verify(
                this.verificationKey,
                publicSignals,
                proof
            );

            // Cache the result
            this.proofCache.set(cacheKey, verification);

            return verification;

        } catch (error) {
            logger.error('Message proof verification failed:', error);
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

module.exports = MessageProofGenerator;