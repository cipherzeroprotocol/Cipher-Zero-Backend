class BridgeAdapter {
    constructor(connection, neonEvmUrl) {
        this.connection = connection;
        this.neonEvm = new NeonEVM(neonEvmUrl);
        this.cache = redis.getClient();
        
        this.initializeContracts();
        this.initializeWormhole();
    }

    async initializeContracts() {
        try {
            // Initialize Solana bridge program
            this.bridgeProgram = new Program(
                require('../idl/wormholeBridge.json'),
                new PublicKey(process.env.BRIDGE_PROGRAM_ID),
                this.connection
            );

            // Initialize Neon EVM bridge contract
            const bridgeAbi = require('../abi/WormholeBridge.json');
            this.evmContract = new ethers.Contract(
                process.env.BRIDGE_EVM_ADDRESS,
                bridgeAbi,
                this.neonEvm.provider
            );

            logger.info('Bridge contracts initialized successfully');
        } catch (error) {
            logger.error(`Bridge contract initialization failed: ${error.message}`);
            throw error;
        }
    }

    async initializeWormhole() {
        try {
            this.wormhole = new Wormhole({
                rpc: process.env.WORMHOLE_RPC,
                bridge: process.env.WORMHOLE_BRIDGE_ADDRESS,
            });
            
            await this.wormhole.initialize();
        } catch (error) {
            logger.error(`Wormhole initialization failed: ${error.message}`);
            throw error;
        }
    }

    async transferCrossChain(sender, targetChain, recipient, amount, zkProof) {
        const startTime = Date.now();
        try {
            // Verify chain support
            if (!this.isSupportedChain(targetChain)) {
                throw new Error('Unsupported target chain');
            }

            // Create bridge transaction
            const tx = await this.bridgeProgram.methods
                .initiateTransfer(targetChain, recipient, amount, zkProof)
                .accounts({
                    sender,
                    wormholeBridge: this.wormhole.bridge,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Execute transaction
            const result = await this.executeTransaction(tx, sender);
            
            // Monitor transfer status
            this.monitorTransferStatus(result.transactionId, targetChain);
            
            metrics.crossChainTransferInitiated(Date.now() - startTime);
            
            return result;
        } catch (error) {
            metrics.crossChainTransferFailed(error.name);
            throw error;
        }
    }

    async completeTransfer(vaa, recipient, zkProof) {
        try {
            // Verify VAA
            const validVaa = await this.wormhole.verifyVAA(vaa);
            if (!validVaa) {
                throw new Error('Invalid VAA');
            }

            // Create completion transaction
            const tx = await this.bridgeProgram.methods
                .completeTransfer(vaa, zkProof)
                .accounts({
                    recipient,
                    wormholeBridge: this.wormhole.bridge,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            return await this.executeTransaction(tx, recipient);
        } catch (error) {
            logger.error(`Transfer completion failed: ${error.message}`);
            throw error;
        }
    }

    async getTransferStatus(transferId) {
        try {
            // Check cache first
            const cachedStatus = await this.cache.get(`transfer:${transferId}`);
            if (cachedStatus) {
                return JSON.parse(cachedStatus);
            }

            const status = await this.bridgeProgram.account.transferAccount.fetch(
                transferId
            );
            
            // Cache status
            await this.cache.setex(
                `transfer:${transferId}`,
                30, // 30 seconds cache
                JSON.stringify(status)
            );

            return status;
        } catch (error) {
            logger.error(`Status check failed: ${error.message}`);
            throw error;
        }
    }

    async monitorTransferStatus(transferId, targetChain) {
        const interval = setInterval(async () => {
            try {
                const status = await this.getTransferStatus(transferId);
                
                if (status.status === 'completed' || status.status === 'failed') {
                    clearInterval(interval);
                    metrics.crossChainTransferCompleted(status.status === 'completed');
                }
            } catch (error) {
                logger.error(`Transfer monitoring failed: ${error.message}`);
            }
        }, 10000); // Check every 10 seconds
    }

    isSupportedChain(chainId) {
        const supportedChains = [1, 2, 3]; // Example chain IDs
        return supportedChains.includes(chainId);
    }
}

module.exports = {
    MessagingAdapter,
    TokenAdapter,
    BridgeAdapter
};