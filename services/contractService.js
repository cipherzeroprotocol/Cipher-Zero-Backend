// /neon-evm/services/contractService.js
const Web3 = require('web3');
const { neonConfig, contractsConfig } = require('../../config');
const logger = require('../../utils/logger');

class ContractService {
    constructor() {
        this.web3 = null;
        this.contracts = {};
        this.account = null;
        this.network = neonConfig.network;
        this.initialized = false;
        this.retryCount = 0;
        this.MAX_RETRIES = 3;
    }

    /**
     * Initialize Web3 and contract instances
     */
    async initialize(privateKey) {
        try {
            // Initialize Web3
            this.web3 = new Web3(neonConfig.networks[this.network].url);

            // Set up account
            if (privateKey) {
                this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
                this.web3.eth.accounts.wallet.add(this.account);
            }

            // Initialize contract instances
            await this.initializeContracts();

            this.initialized = true;
            logger.info('Contract service initialized successfully');

        } catch (error) {
            logger.error('Contract service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize all contract instances
     */
    async initializeContracts() {
        try {
            // File Registry Contract
            this.contracts.fileRegistry = new this.web3.eth.Contract(
                contractsConfig.abis.fileRegistry,
                contractsConfig.addresses[this.network].fileRegistry
            );

            // Message Registry Contract
            this.contracts.messageRegistry = new this.web3.eth.Contract(
                contractsConfig.abis.messageRegistry,
                contractsConfig.addresses[this.network].messageRegistry
            );

            // Privacy Pool Contract
            this.contracts.privacyPool = new this.web3.eth.Contract(
                contractsConfig.abis.privacyPool,
                contractsConfig.addresses[this.network].privacyPool
            );

            // Cipher Zero Token Contract
            this.contracts.cipherZeroToken = new this.web3.eth.Contract(
                contractsConfig.abis.cipherZeroToken,
                contractsConfig.addresses[this.network].cipherZeroToken
            );

            // Subscribe to contract events
            this.subscribeToEvents();

        } catch (error) {
            logger.error('Contract initialization failed:', error);
            throw error;
        }
    }

    /**
     * File Registry Methods
     */
    async storeFile(fileHash, metadata, proof) {
        try {
            const tx = this.contracts.fileRegistry.methods.storeFile(
                fileHash,
                metadata,
                proof
            );

            return await this.sendTransaction(tx);
        } catch (error) {
            logger.error('Store file failed:', error);
            throw error;
        }
    }

    async shareFile(fileHash, recipient, permissions) {
        try {
            const tx = this.contracts.fileRegistry.methods.shareFile(
                fileHash,
                recipient,
                permissions
            );

            return await this.sendTransaction(tx);
        } catch (error) {
            logger.error('Share file failed:', error);
            throw error;
        }
    }

    async getFileMetadata(fileHash) {
        try {
            return await this.contracts.fileRegistry.methods
                .getFileMetadata(fileHash)
                .call();
        } catch (error) {
            logger.error('Get file metadata failed:', error);
            throw error;
        }
    }

    /**
     * Message Registry Methods
     */
    async storeMessage(commitment, nullifier, recipient, encryptedContent, proof) {
        try {
            const tx = this.contracts.messageRegistry.methods.storeMessage(
                commitment,
                nullifier,
                recipient,
                encryptedContent,
                proof
            );

            return await this.sendTransaction(tx);
        } catch (error) {
            logger.error('Store message failed:', error);
            throw error;
        }
    }

    async getUserMessages(userAddress, offset = 0, limit = 20) {
        try {
            return await this.contracts.messageRegistry.methods
                .getUserMessages(userAddress, offset, limit)
                .call();
        } catch (error) {
            logger.error('Get user messages failed:', error);
            throw error;
        }
    }

    /**
     * Privacy Pool Methods
     */
    async deposit(commitment, amount, proof) {
        try {
            // First approve token transfer
            const approveTx = this.contracts.cipherZeroToken.methods.approve(
                this.contracts.privacyPool.options.address,
                amount
            );
            await this.sendTransaction(approveTx);

            // Then deposit
            const depositTx = this.contracts.privacyPool.methods.deposit(
                commitment,
                amount,
                proof
            );

            return await this.sendTransaction(depositTx);
        } catch (error) {
            logger.error('Deposit failed:', error);
            throw error;
        }
    }

    async withdraw(nullifier, commitment, recipient, amount, proof) {
        try {
            const tx = this.contracts.privacyPool.methods.withdraw(
                nullifier,
                commitment,
                recipient,
                amount,
                proof
            );

            return await this.sendTransaction(tx);
        } catch (error) {
            logger.error('Withdrawal failed:', error);
            throw error;
        }
    }

    /**
     * Transaction Handling
     */
    async sendTransaction(tx) {
        try {
            const gas = await tx.estimateGas({ from: this.account.address });
            const gasPrice = await this.web3.eth.getGasPrice();

            const transaction = {
                from: this.account.address,
                to: tx._parent._address,
                data: tx.encodeABI(),
                gas: Math.round(gas * contractsConfig.settings.gasLimitMultiplier),
                gasPrice: gasPrice,
                nonce: await this.web3.eth.getTransactionCount(this.account.address)
            };

            const signedTx = await this.web3.eth.accounts.signTransaction(
                transaction,
                this.account.privateKey
            );

            const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);
            return receipt;

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
     * Event Handling
     */
    subscribeToEvents() {
        // File Registry Events
        this.contracts.fileRegistry.events.FileStored()
            .on('data', event => this.handleFileStoredEvent(event))
            .on('error', error => logger.error('File stored event error:', error));

        // Message Registry Events
        this.contracts.messageRegistry.events.MessageStored()
            .on('data', event => this.handleMessageStoredEvent(event))
            .on('error', error => logger.error('Message stored event error:', error));

        // Privacy Pool Events
        this.contracts.privacyPool.events.allEvents()
            .on('data', event => this.handlePrivacyPoolEvent(event))
            .on('error', error => logger.error('Privacy pool event error:', error));
    }

    handleFileStoredEvent(event) {
        logger.info('File stored event:', {
            fileHash: event.returnValues.fileHash,
            owner: event.returnValues.owner,
            timestamp: event.returnValues.timestamp
        });
    }

    handleMessageStoredEvent(event) {
        logger.info('Message stored event:', {
            commitment: event.returnValues.commitment,
            recipient: event.returnValues.recipient,
            timestamp: event.returnValues.timestamp
        });
    }

    handlePrivacyPoolEvent(event) {
        logger.info('Privacy pool event:', {
            type: event.event,
            values: event.returnValues
        });
    }

    /**
     * Utility Methods
     */
    async getBalance(address) {
        try {
            return await this.contracts.cipherZeroToken.methods
                .balanceOf(address)
                .call();
        } catch (error) {
            logger.error('Get balance failed:', error);
            throw error;
        }
    }

    async getNonce(address) {
        try {
            return await this.web3.eth.getTransactionCount(address);
        } catch (error) {
            logger.error('Get nonce failed:', error);
            throw error;
        }
    }

    isInitialized() {
        return this.initialized;
    }
}

module.exports = new ContractService();