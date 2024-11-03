// /zk-proof/verifiers/commitmentVerifier.js
const { poseidon } = require('circomlib');
const logger = require('../../utils/logger');

class CommitmentVerifier {
    constructor() {
        this.commitments = new Map();
        this.nullifiers = new Map();
        this.COMMITMENT_TYPES = {
            FILE: 'file',
            MESSAGE: 'message',
            TRANSFER: 'transfer'
        };
    }

    /**
     * Verify commitment
     */
    async verifyCommitment(commitmentData) {
        try {
            const {
                type,
                commitment,
                nullifier,
                input
            } = commitmentData;

            // Check if nullifier has been used
            if (this.isNullifierUsed(nullifier)) {
                logger.warn('Nullifier already used:', nullifier);
                return false;
            }

            // Verify commitment format
            if (!this.isValidCommitmentFormat(commitment)) {
                logger.warn('Invalid commitment format:', commitment);
                return false;
            }

            // Compute expected commitment
            const expectedCommitment = await this.computeCommitment(type, input);
            
            // Verify commitment matches
            const isValid = commitment === expectedCommitment;

            if (isValid) {
                // Store commitment and nullifier
                this.storeCommitment(commitment, {
                    type,
                    nullifier,
                    timestamp: Date.now()
                });
            }

            return isValid;

        } catch (error) {
            logger.error('Commitment verification failed:', error);
            throw error;
        }
    }

    /**
     * Verify batch commitments
     */
    async verifyBatchCommitments(commitments) {
        try {
            const results = await Promise.all(
                commitments.map(async commitment => {
                    try {
                        const isValid = await this.verifyCommitment(commitment);
                        return {
                            type: commitment.type,
                            isValid,
                            error: null
                        };
                    } catch (error) {
                        return {
                            type: commitment.type,
                            isValid: false,
                            error: error.message
                        };
                    }
                })
            );

            return results;

        } catch (error) {
            logger.error('Batch commitment verification failed:', error);
            throw error;
        }
    }

    /**
     * Check if nullifier has been used
     */
    isNullifierUsed(nullifier) {
        return this.nullifiers.has(nullifier);
    }

    /**
     * Verify commitment format
     */
    isValidCommitmentFormat(commitment) {
        // Check commitment is valid hex string of correct length
        return /^0x[0-9a-fA-F]{64}$/.test(commitment);
    }

    /**
     * Compute commitment from input
     */
    async computeCommitment(type, input) {
        try {
            switch (type) {
                case this.COMMITMENT_TYPES.FILE:
                    return this.computeFileCommitment(input);
                case this.COMMITMENT_TYPES.MESSAGE:
                    return this.computeMessageCommitment(input);
                case this.COMMITMENT_TYPES.TRANSFER:
                    return this.computeTransferCommitment(input);
                default:
                    throw new Error(`Unknown commitment type: ${type}`);
            }
        } catch (error) {
            logger.error('Commitment computation failed:', error);
            throw error;
        }
    }

    /**
     * Compute file commitment
     */
    computeFileCommitment(input) {
        const {
            fileHash,
            metadata,
            owner,
            recipient,
            randomness
        } = input;

        return poseidon([
            BigInt(fileHash),
            BigInt(owner),
            BigInt(recipient || 0),
            BigInt(metadata),
            BigInt(randomness)
        ]).toString();
    }

    /**
     * Compute message commitment
     */
    computeMessageCommitment(input) {
        const {
            message,
            sender,
            recipient,
            nonce,
            randomness
        } = input;

        return poseidon([
            BigInt(message),
            BigInt(sender),
            BigInt(recipient),
            BigInt(nonce),
            BigInt(randomness)
        ]).toString();
    }

    /**
     * Compute transfer commitment
     */
    computeTransferCommitment(input) {
        const {
            amount,
            sender,
            recipient,
            tokenId,
            randomness
        } = input;

        return poseidon([
            BigInt(amount),
            BigInt(sender),
            BigInt(recipient),
            BigInt(tokenId),
            BigInt(randomness)
        ]).toString();
    }

    /**
     * Store commitment
     */
    storeCommitment(commitment, data) {
        this.commitments.set(commitment, data);
        this.nullifiers.set(data.nullifier, commitment);
    }

    /**
     * Get commitment data
     */
    getCommitment(commitment) {
        return this.commitments.get(commitment);
    }

    /**
     * Clean up old commitments
     */
    cleanupOldCommitments() {
        const MAX_AGE = 86400000; // 24 hours
        const now = Date.now();

        for (const [commitment, data] of this.commitments) {
            if (now - data.timestamp > MAX_AGE) {
                this.nullifiers.delete(data.nullifier);
                this.commitments.delete(commitment);
            }
        }
    }
}

module.exports = new CommitmentVerifier();