// /neon-evm/adapters/privacyPoolAdapter.js
const Web3 = require('web3');
const { neonConfig, contractsConfig } = require('../../config');
const { ProofService } = require('../services/proofService');
const { generateMerkleProof } = require('../utils/merkle');
const logger = require('../../utils/logger');

class PrivacyPoolAdapter {
    constructor(web3Instance = null) {
        this.web3 = web3Instance || new Web3(neonConfig.networks[neonConfig.network].url);
        this.contract = null;
        this.tokenContract = null;
        this.account = null;
        this.proofService = ProofService;
        this.retryCount = 0;
        this.MAX_RETRIES = 3;
        this.initialized = false;
        this.noteCache = new Map();
        this.CACHE_TTL = 3600000; // 1 hour
    }

    /**
     * Initialize the adapter
     */
    async initialize(privateKey) {
        try {
            if (this.initialized) return;

            // Set up account if private key provided
            if (privateKey) {
                this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
                this.web3.eth.accounts.wallet.add(this.account);
            }

            // Initialize Privacy Pool contract
            this.contract = new this.web3.eth.Contract(
                contractsConfig.abis.privacyPool,
                contractsConfig.addresses[neonConfig.network].privacyPool
            );

            // Initialize Token contract
            this.tokenContract = new this.web3.eth.Contract(
                contractsConfig.abis.cipherZeroToken,
                contractsConfig.addresses[neonConfig.network].cipherZeroToken
            );

            this.initialized = true;
            logger.info('PrivacyPool adapter initialized');

        } catch (error) {
            logger.error('PrivacyPool adapter initialization failed:', error);
            throw error;
        }
    }

    /**
     * Deposit tokens into privacy pool
     */
    async deposit(depositData) {
        try {
            const {
                amount,
                recipient = this.account.address,
                note = null
            } = depositData;

            // Generate commitment and proof
            const depositNote = note || await this.generateNote(amount, recipient);
            const proof = await this.proofService.generateTransferProof({
                amount: depositNote.amount,
                sender: this.account.address,
                recipient: depositNote.recipient,
                nullifier: depositNote.nullifier
            });

            // Approve token transfer
            const approveTx = this.tokenContract.methods.approve(
                this.contract.options.address,
                amount
            );
            await this.sendTransaction(approveTx);

            // Prepare deposit transaction
            const tx = this.contract.methods.deposit(
                proof.commitment,
                amount,
                proof.proof,
                proof.publicSignals
            );

            // Send transaction
            const receipt = await this.sendTransaction(tx);

            // Cache note
            this.cacheNote(proof.commitment, depositNote);

            logger.info('Deposit successful:', {
                commitment: proof.commitment,
                amount,
                transactionHash: receipt.transactionHash
            });

            return {
                transactionHash: receipt.transactionHash,
                commitment: proof.commitment,
                note: depositNote
            };

        } catch (error) {
            logger.error('Deposit failed:', error);
            throw error;
        }
    }

    /**
     * Withdraw tokens from privacy pool
     */
    async withdraw(withdrawData) {
        try {
            const {
                note,
                recipient,
                amount,
                relayer = null
            } = withdrawData;

            // Verify note exists in pool
            const noteExists = await this.verifyNote(note);
            if (!noteExists) {
                throw new Error('Invalid note');
            }

            // Generate withdrawal proof
            const proof = await this.proofService.generateTransferProof({
                amount,
                sender: note.owner,
                recipient,
                nullifier: note.nullifier,
                note: note
            });

            // Prepare withdraw transaction
            const tx = this.contract.methods.withdraw(
                proof.nullifier,
                proof.commitment,
                recipient,
                amount,
                proof.proof,
                proof.publicSignals,
                relayer
            );

            // Send transaction
            const receipt = await this.sendTransaction(tx);

            logger.info('Withdrawal successful:', {
                nullifier: proof.nullifier,
                recipient,
                amount,
                transactionHash: receipt.transactionHash
            });

            return {
                transactionHash: receipt.transactionHash,
                nullifier: proof.nullifier
            };

        } catch (error) {
            logger.error('Withdrawal failed:', error);
            throw error;
        }
    }

    /**
     * Transfer tokens privately
     */
    async transfer(transferData) {
        try {
            const {
                note,
                recipient,
                amount
            } = transferData;

            // First deposit
            const depositResult = await this.deposit({
                amount,
                recipient,
                note
            });

            // Then withdraw
            const withdrawResult = await this.withdraw({
                note: depositResult.note,
                recipient,
                amount
            });

            return {
                deposit: depositResult,
                withdrawal: withdrawResult
            };

        } catch (error) {
            logger.error('Transfer failed:', error);
            throw error;
        }
    }

    /**
     * Get note commitments
     */
    async getNoteCommitments(address) {
        try {
            return await this.contract.methods
                .getNoteCommitments(address)
                .call();
        } catch (error) {
            logger.error('Get note commitments failed:', error);
            throw error;
        }
    }

    /**
     * Verify note exists in pool
     */
    async verifyNote(note) {
        try {
            const commitment = await this.generateCommitment(note);
            const noteExists = await this.contract.methods
                .isCommitmentSpent(commitment)
                .call();
            return !noteExists;
        } catch (error) {
            logger.error('Note verification failed:', error);
            throw error;
        }
    }

    /**
     * Generate note for deposit
     */
    async generateNote(amount, recipient) {
        try {
            const nullifier = await this.generateNullifier();
            const randomness = await this.generateRandomness();

            return {
                amount: amount.toString(),
                owner: this.account.address,
                recipient,
                nullifier,
                randomness,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error('Note generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate commitment from note
     */
    async generateCommitment(note) {
        try {
            const commitment = this.web3.utils.soliditySha3(
                { t: 'uint256', v: note.amount },
                { t: 'address', v: note.owner },
                { t: 'address', v: note.recipient },
                { t: 'bytes32', v: note.nullifier },
                { t: 'bytes32', v: note.randomness }
            );
            return commitment;
        } catch (error) {
            logger.error('Commitment generation failed:', error);
            throw error;
        }
    }

    /**
     * Generate nullifier
     */
    async generateNullifier() {
        const randomness = await this.generateRandomness();
        return this.web3.utils.soliditySha3(
            { t: 'bytes32', v: randomness },
            { t: 'uint256', v: Date.now() }
        );
    }

    /**
     * Generate randomness
     */
    async generateRandomness() {
        return this.web3.utils.randomHex(32);
    }

    /**
     * Note caching
     */
    cacheNote(commitment, note) {
        this.noteCache.set(commitment, note);
        setTimeout(() => this.noteCache.delete(commitment), this.CACHE_TTL);
    }

    /**
     * Transaction handling
     */
    async sendTransaction(tx) {
        try {
            const gas = await tx.estimateGas({ from: this.account.address });
            const gasPrice = await this.web3.eth.getGasPrice();

            const transaction = {
                from: this.account.address,
                to: tx._parent.options.address,
                data: tx.encodeABI(),
                gas: Math.round(gas * 1.2), // Add 20% buffer
                gasPrice: gasPrice,
                nonce: await this.web3.eth.getTransactionCount(this.account.address)
            };

            const signedTx = await this.web3.eth.accounts.signTransaction(
                transaction,
                this.account.privateKey
            );

            return await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        } catch (error) {
            if (
                this.retryCount < this.MAX_RETRIES &&
                (error.message.includes('nonce too low') ||
                error.message.includes('replacement transaction underpriced'))
            ) {
                this.retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.sendTransaction(tx);
            }
            this.retryCount = 0;
            throw error;
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.noteCache.clear();
    }
}

module.exports = new PrivacyPoolAdapter();