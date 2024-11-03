// /neon-evm/services/eventListenerService.js
const Web3 = require('web3');
const { EventEmitter } = require('events');
const { neonConfig, contractsConfig } = require('../../config');
const logger = require('../../utils/logger');

class EventListenerService extends EventEmitter {
    constructor() {
        super();
        this.web3 = null;
        this.contracts = {};
        this.eventSubscriptions = new Map();
        this.eventProcessors = new Map();
        this.blockProcessors = new Map();
        this.lastProcessedBlock = null;
        this.isProcessing = false;
        this.retryTimeout = 5000; // 5 seconds
        this.maxRetries = 3;
    }

    /**
     * Initialize the event listener service
     */
    async initialize(web3Instance) {
        try {
            this.web3 = web3Instance || new Web3(neonConfig.networks[neonConfig.network].url);
            await this.initializeContracts();
            await this.setupEventProcessors();
            await this.startEventListening();
            logger.info('Event listener service initialized');
        } catch (error) {
            logger.error('Event listener initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize contract instances
     */
    async initializeContracts() {
        this.contracts.fileRegistry = new this.web3.eth.Contract(
            contractsConfig.abis.fileRegistry,
            contractsConfig.addresses[neonConfig.network].fileRegistry
        );

        this.contracts.messageRegistry = new this.web3.eth.Contract(
            contractsConfig.abis.messageRegistry,
            contractsConfig.addresses[neonConfig.network].messageRegistry
        );

        this.contracts.privacyPool = new this.web3.eth.Contract(
            contractsConfig.abis.privacyPool,
            contractsConfig.addresses[neonConfig.network].privacyPool
        );
    }

    /**
     * Setup event processors
     */
    async setupEventProcessors() {
        // File Registry Events
        this.eventProcessors.set('FileStored', async (event) => {
            try {
                const { fileHash, owner, metadata } = event.returnValues;
                
                // Process file storage event
                await this.processFileStoredEvent(fileHash, owner, metadata);
                
                // Emit processed event
                this.emit('fileStored', {
                    fileHash,
                    owner,
                    metadata,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            } catch (error) {
                logger.error('File stored event processing failed:', error);
            }
        });

        this.eventProcessors.set('FileShared', async (event) => {
            try {
                const { fileHash, owner, recipient, permissions } = event.returnValues;
                
                // Process file sharing event
                await this.processFileSharedEvent(fileHash, owner, recipient, permissions);
                
                // Emit processed event
                this.emit('fileShared', {
                    fileHash,
                    owner,
                    recipient,
                    permissions,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            } catch (error) {
                logger.error('File shared event processing failed:', error);
            }
        });

        // Message Registry Events
        this.eventProcessors.set('MessageStored', async (event) => {
            try {
                const { commitment, sender, recipient } = event.returnValues;
                
                // Process message storage event
                await this.processMessageStoredEvent(commitment, sender, recipient);
                
                // Emit processed event
                this.emit('messageStored', {
                    commitment,
                    sender,
                    recipient,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            } catch (error) {
                logger.error('Message stored event processing failed:', error);
            }
        });

        // Privacy Pool Events
        this.eventProcessors.set('Deposit', async (event) => {
            try {
                const { commitment, amount } = event.returnValues;
                
                // Process deposit event
                await this.processDepositEvent(commitment, amount);
                
                // Emit processed event
                this.emit('deposit', {
                    commitment,
                    amount,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            } catch (error) {
                logger.error('Deposit event processing failed:', error);
            }
        });

        this.eventProcessors.set('Withdrawal', async (event) => {
            try {
                const { nullifier, recipient, amount } = event.returnValues;
                
                // Process withdrawal event
                await this.processWithdrawalEvent(nullifier, recipient, amount);
                
                // Emit processed event
                this.emit('withdrawal', {
                    nullifier,
                    recipient,
                    amount,
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber
                });
            } catch (error) {
                logger.error('Withdrawal event processing failed:', error);
            }
        });
    }

    /**
     * Start listening for events
     */
    async startEventListening() {
        try {
            // Get latest block
            this.lastProcessedBlock = await this.web3.eth.getBlockNumber();

            // Subscribe to FileRegistry events
            this.subscribeToContractEvents(
                this.contracts.fileRegistry,
                ['FileStored', 'FileShared']
            );

            // Subscribe to MessageRegistry events
            this.subscribeToContractEvents(
                this.contracts.messageRegistry,
                ['MessageStored', 'MessageRead']
            );

            // Subscribe to PrivacyPool events
            this.subscribeToContractEvents(
                this.contracts.privacyPool,
                ['Deposit', 'Withdrawal']
            );

            // Start block processing
            this.startBlockProcessing();

            logger.info('Event listening started');
        } catch (error) {
            logger.error('Failed to start event listening:', error);
            throw error;
        }
    }

    /**
     * Subscribe to contract events
     */
    subscribeToContractEvents(contract, eventNames) {
        for (const eventName of eventNames) {
            const subscription = contract.events[eventName]()
                .on('data', (event) => this.handleEvent(eventName, event))
                .on('error', (error) => this.handleEventError(eventName, error));

            this.eventSubscriptions.set(eventName, subscription);
        }
    }

    /**
     * Handle individual event
     */
    async handleEvent(eventName, event) {
        try {
            const processor = this.eventProcessors.get(eventName);
            if (processor) {
                await processor(event);
            }
        } catch (error) {
            logger.error(`Error processing ${eventName} event:`, error);
            this.emit('eventError', { eventName, error, event });
        }
    }

    /**
     * Handle event error
     */
    handleEventError(eventName, error) {
        logger.error(`Error in ${eventName} subscription:`, error);
        this.emit('subscriptionError', { eventName, error });

        // Attempt to resubscribe
        setTimeout(() => this.resubscribeToEvent(eventName), this.retryTimeout);
    }

    /**
     * Process block events
     */
    async startBlockProcessing() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            while (this.isProcessing) {
                const currentBlock = await this.web3.eth.getBlockNumber();
                
                if (currentBlock > this.lastProcessedBlock) {
                    await this.processNewBlocks(
                        this.lastProcessedBlock + 1,
                        currentBlock
                    );
                    this.lastProcessedBlock = currentBlock;
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            logger.error('Block processing error:', error);
            this.isProcessing = false;
            
            // Attempt to restart block processing
            setTimeout(() => this.startBlockProcessing(), this.retryTimeout);
        }
    }

    /**
     * Process new blocks
     */
    async processNewBlocks(fromBlock, toBlock) {
        try {
            // Get past events for each contract
            await Promise.all([
                this.processContractBlockRange(this.contracts.fileRegistry, fromBlock, toBlock),
                this.processContractBlockRange(this.contracts.messageRegistry, fromBlock, toBlock),
                this.processContractBlockRange(this.contracts.privacyPool, fromBlock, toBlock)
            ]);
        } catch (error) {
            logger.error('Error processing blocks:', error);
            throw error;
        }
    }

    /**
     * Process contract events in block range
     */
    async processContractBlockRange(contract, fromBlock, toBlock) {
        try {
            const events = await contract.getPastEvents('allEvents', {
                fromBlock,
                toBlock
            });

            for (const event of events) {
                await this.handleEvent(event.event, event);
            }
        } catch (error) {
            logger.error('Error processing contract block range:', error);
            throw error;
        }
    }

    /**
     * Event specific processors
     */
    async processFileStoredEvent(fileHash, owner, metadata) {
        // Implement file stored event processing
        logger.info('Processing FileStored event:', { fileHash, owner, metadata });
    }

    async processFileSharedEvent(fileHash, owner, recipient, permissions) {
        // Implement file shared event processing
        logger.info('Processing FileShared event:', { fileHash, owner, recipient, permissions });
    }

    async processMessageStoredEvent(commitment, sender, recipient) {
        // Implement message stored event processing
        logger.info('Processing MessageStored event:', { commitment, sender, recipient });
    }

    async processDepositEvent(commitment, amount) {
        // Implement deposit event processing
        logger.info('Processing Deposit event:', { commitment, amount });
    }

    async processWithdrawalEvent(nullifier, recipient, amount) {
        // Implement withdrawal event processing
        logger.info('Processing Withdrawal event:', { nullifier, recipient, amount });
    }

    /**
     * Stop event listening
     */
    async stop() {
        this.isProcessing = false;
        
        // Unsubscribe from all events
        for (const [eventName, subscription] of this.eventSubscriptions) {
            subscription.unsubscribe();
            this.eventSubscriptions.delete(eventName);
        }

        logger.info('Event listener service stopped');
    }
}

module.exports = new EventListenerService();