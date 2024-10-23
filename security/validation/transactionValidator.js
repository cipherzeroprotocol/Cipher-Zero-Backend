class TransactionValidator {
    constructor(connection, proofValidator) {
        this.connection = connection;
        this.proofValidator = proofValidator;
        this.validationCache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    }

    async validateTransaction(transaction, zkProof = null) {
        try {
            // Check transaction structure
            if (!this.validateTransactionStructure(transaction)) {
                throw new Error('Invalid transaction structure');
            }

            // If ZK proof is provided, validate it first
            if (zkProof) {
                const proofValid = await this.proofValidator.validateZkProof(
                    zkProof,
                    this.extractPublicInputs(transaction),
                    'TRANSACTION'
                );
                
                if (!proofValid) {
                    throw new Error('Invalid ZK proof for transaction');
                }
            }

            // Validate transaction signatures
            await this.validateSignatures(transaction);

            // Validate account states
            await this.validateAccountStates(transaction);

            // Validate transaction constraints
            await this.validateConstraints(transaction);

            return true;
        } catch (error) {
            console.error(`Transaction validation error: ${error.message}`);
            return false;
        }
    }

    validateTransactionStructure(transaction) {
        try {
            // Check if transaction has all required fields
            const requiredFields = ['instructions', 'recentBlockhash', 'feePayer'];
            for (const field of requiredFields) {
                if (!transaction[field]) {
                    return false;
                }
            }

            // Validate instructions
            if (!Array.isArray(transaction.instructions) || transaction.instructions.length === 0) {
                return false;
            }

            // Validate each instruction
            for (const instruction of transaction.instructions) {
                if (!instruction.programId || !instruction.keys || !instruction.data) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    async validateSignatures(transaction) {
        try {
            // Validate all signatures in the transaction
            for (const signature of transaction.signatures) {
                const publicKey = new PublicKey(signature.publicKey);
                const verified = await this.verifySignature(
                    signature.signature,
                    publicKey,
                    transaction.message
                );
                
                if (!verified) {
                    throw new Error(`Invalid signature for public key: ${publicKey.toBase58()}`);
                }
            }

            return true;
        } catch (error) {
            throw new Error(`Signature validation failed: ${error.message}`);
        }
    }

    async validateAccountStates(transaction) {
        try {
            // Get all unique accounts from transaction
            const accounts = new Set(
                transaction.instructions.flatMap(ix => 
                    ix.keys.map(key => key.pubkey.toBase58())
                )
            );

            // Fetch and validate account states
            for (const account of accounts) {
                const accountInfo = await this.connection.getAccountInfo(
                    new PublicKey(account)
                );

                if (!accountInfo) {
                    throw new Error(`Account not found: ${account}`);
                }

                // Validate account data based on transaction requirements
                await this.validateAccountData(accountInfo, transaction);
            }

            return true;
        } catch (error) {
            throw new Error(`Account state validation failed: ${error.message}`);
        }
    }

    async validateConstraints(transaction) {
        try {
            // Validate transaction size
            if (transaction.serialize().length > 1232) {
                throw new Error('Transaction too large');
            }

            // Validate fee
            const fee = await this.connection.getFeeForMessage(transaction.message);
            if (fee === null) {
                throw new Error('Unable to calculate transaction fee');
            }

            // Additional custom constraints can be added here
            return true;
        } catch (error) {
            throw new Error(`Constraint validation failed: ${error.message}`);
        }
    }

    extractPublicInputs(transaction) {
        // Extract relevant transaction data for ZK proof validation
        return [
            transaction.recentBlockhash,
            transaction.feePayer.toBase58(),
            ...transaction.instructions.map(ix => ix.programId.toBase58())
        ];
    }

    async verifySignature(signature, publicKey, message) {
        try {
            return await this.connection.getSignatureStatus(signature);
        } catch (error) {
            return false;
        }
    }

    async validateAccountData(accountInfo, transaction) {
        // Implement custom account data validation logic
        // This would depend on your specific protocol requirements
        return true;
    }
}

module.exports = {
    ProofValidator,
    TransactionValidator
};