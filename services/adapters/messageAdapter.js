// /neon-evm/adapters/messageAdapter.js
const Web3 = require('web3');
const { neonConfig, contractsConfig } = require('../../config');
const { ProofService } = require('../services/proofService');
const { encryptMessage, decryptMessage } = require('../utils/encryption');
const logger = require('../../utils/logger');

class MessageAdapter {
    constructor(web3Instance = null) {
        this.web3 = web3Instance || new Web3(neonConfig.networks[neonConfig.network].url);
        this.contract = null;
        this.account = null;
        this.proofService = ProofService;
        this.retryCount = 0;
        this.MAX_RETRIES = 3;
        this.initialized = false;
        this.messageCache = new Map();
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

            // Initialize contract
            this.contract = new this.web3.eth.Contract(
                contractsConfig.abis.messageRegistry,
                contractsConfig.addresses[neonConfig.network].messageRegistry
            );

            this.initialized = true;
            logger.info('MessageRegistry adapter initialized');

        } catch (error) {
            logger.error('MessageRegistry adapter initialization failed:', error);
            throw error;
        }
    }

    /**
     * Send encrypted message
     */
    async sendMessage(messageData) {
        try {
            const {
                content,
                recipient,
                recipientPublicKey,
                roomId = null
            } = messageData;

            // Encrypt message
            const {
                encryptedContent,
                encryptedKey,
                nonce
            } = await encryptMessage(content, recipientPublicKey);

            // Generate proof
            const proof = await this.proofService.generateMessageProof({
                messageHash: this.web3.utils.keccak256(encryptedContent),
                sender: this.account.address,
                recipient,
                nonce,
                roomId
            });

            // Prepare transaction
            const tx = this.contract.methods.storeMessage(
                proof.commitment,
                proof.nullifier,
                recipient,
                encryptedContent,
                encryptedKey,
                nonce,
                proof.proof,
                roomId
            );

            // Send transaction
            const receipt = await this.sendTransaction(tx);

            logger.info('Message sent:', {
                commitment: proof.commitment,
                recipient,
                transactionHash: receipt.transactionHash
            });

            return {
                transactionHash: receipt.transactionHash,
                commitment: proof.commitment,
                nullifier: proof.nullifier
            };

        } catch (error) {
            logger.error('Send message failed:', error);
            throw error;
        }
    }

    /**
     * Get user's messages
     */
    async getUserMessages(options = {}) {
        try {
            const {
                offset = 0,
                limit = 20,
                roomId = null,
                includeRead = false
            } = options;

            const messages = await this.contract.methods
                .getUserMessages(
                    this.account.address,
                    offset,
                    limit,
                    roomId,
                    includeRead
                )
                .call();

            // Decrypt messages
            const decryptedMessages = await Promise.all(
                messages.map(msg => this.decryptMessage(msg))
            );

            return decryptedMessages;

        } catch (error) {
            logger.error('Get user messages failed:', error);
            throw error;
        }
    }

    /**
     * Mark message as read
     */
    async markMessageAsRead(commitment) {
        try {
            const tx = this.contract.methods.markMessageRead(commitment);
            const receipt = await this.sendTransaction(tx);

            logger.info('Message marked as read:', {
                commitment,
                transactionHash: receipt.transactionHash
            });

            return receipt;

        } catch (error) {
            logger.error('Mark message as read failed:', error);
            throw error;
        }
    }

    /**
     * Create chat room
     */
    async createRoom(roomData) {
        try {
            const {
                name,
                participants,
                isPrivate = true,
                metadata = {}
            } = roomData;

            // Generate proof for room creation
            const proof = await this.proofService.generateMessageProof({
                roomName: name,
                creator: this.account.address,
                participants,
                isPrivate
            });

            // Prepare transaction
            const tx = this.contract.methods.createRoom(
                name,
                participants,
                isPrivate,
                metadata,
                proof.proof,
                proof.publicSignals
            );

            // Send transaction
            const receipt = await this.sendTransaction(tx);

            const roomId = receipt.events.RoomCreated.returnValues.roomId;

            logger.info('Room created:', {
                roomId,
                name,
                transactionHash: receipt.transactionHash
            });

            return {
                roomId,
                transactionHash: receipt.transactionHash
            };

        } catch (error) {
            logger.error('Create room failed:', error);
            throw error;
        }
    }

    /**
     * Get room messages
     */
    async getRoomMessages(roomId, options = {}) {
        try {
            const {
                offset = 0,
                limit = 50,
                includeRead = true
            } = options;

            const messages = await this.contract.methods
                .getRoomMessages(roomId, offset, limit, includeRead)
                .call();

            // Decrypt messages
            const decryptedMessages = await Promise.all(
                messages.map(msg => this.decryptMessage(msg))
            );

            return decryptedMessages;

        } catch (error) {
            logger.error('Get room messages failed:', error);
            throw error;
        }
    }

    /**
     * Add participant to room
     */
    async addParticipant(roomId, participant) {
        try {
            // Verify room ownership
            const isOwner = await this.isRoomOwner(roomId, this.account.address);
            if (!isOwner) {
                throw new Error('Not room owner');
            }

            const tx = this.contract.methods.addParticipant(roomId, participant);
            const receipt = await this.sendTransaction(tx);

            logger.info('Participant added to room:', {
                roomId,
                participant,
                transactionHash: receipt.transactionHash
            });

            return receipt;

        } catch (error) {
            logger.error('Add participant failed:', error);
            throw error;
        }
    }

    /**
     * Remove participant from room
     */
    async removeParticipant(roomId, participant) {
        try {
            // Verify room ownership
            const isOwner = await this.isRoomOwner(roomId, this.account.address);
            if (!isOwner) {
                throw new Error('Not room owner');
            }

            const tx = this.contract.methods.removeParticipant(roomId, participant);
            const receipt = await this.sendTransaction(tx);

            logger.info('Participant removed from room:', {
                roomId,
                participant,
                transactionHash: receipt.transactionHash
            });

            return receipt;

        } catch (error) {
            logger.error('Remove participant failed:', error);
            throw error;
        }
    }

    /**
     * Message decryption
     */
    async decryptMessage(message) {
        try {
            // Check cache first
            const cacheKey = `msg:${message.commitment}`;
            if (this.messageCache.has(cacheKey)) {
                return this.messageCache.get(cacheKey);
            }

            const decryptedContent = await decryptMessage(
                message.encryptedContent,
                message.encryptedKey,
                message.nonce,
                this.account.privateKey
            );

            const decryptedMessage = {
                ...message,
                content: decryptedContent
            };

            // Cache decrypted message
            this.messageCache.set(cacheKey, decryptedMessage);
            setTimeout(() => this.messageCache.delete(cacheKey), this.CACHE_TTL);

            return decryptedMessage;

        } catch (error) {
            logger.error('Message decryption failed:', error);
            return {
                ...message,
                content: null,
                error: 'Decryption failed'
            };
        }
    }

    /**
     * Utility methods
     */
    async isRoomOwner(roomId, address) {
        try {
            const room = await this.contract.methods.getRoom(roomId).call();
            return room.owner.toLowerCase() === address.toLowerCase();
        } catch (error) {
            logger.error('Room ownership check failed:', error);
            throw error;
        }
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
                to: this.contract.options.address,
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
        this.messageCache.clear();
    }
}

module.exports = new MessageAdapter();