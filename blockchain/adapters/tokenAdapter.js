class TokenAdapter {
    constructor(connection, neonEvmUrl) {
        this.connection = connection;
        this.neonEvm = new NeonEVM(neonEvmUrl);
        this.cache = redis.getClient();
        
        this.initializeContracts();
    }

    async initializeContracts() {
        try {
            // Initialize Solana token program
            this.tokenProgram = new Program(
                require('../idl/cipherZeroToken.json'),
                new PublicKey(process.env.TOKEN_PROGRAM_ID),
                this.connection
            );

            // Initialize Neon EVM token contract
            const tokenAbi = require('../abi/CipherZeroToken.json');
            this.evmContract = new ethers.Contract(
                process.env.TOKEN_EVM_ADDRESS,
                tokenAbi,
                this.neonEvm.provider
            );

            logger.info('Token contracts initialized successfully');
        } catch (error) {
            logger.error(`Token contract initialization failed: ${error.message}`);
            throw error;
        }
    }

    async transfer(sender, recipient, amount, zkProof) {
        try {
            const tx = await this.tokenProgram.methods
                .transfer(recipient, amount, zkProof)
                .accounts({
                    sender,
                    recipient,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .transaction();

            return await this.executeTransaction(tx, sender);
        } catch (error) {
            logger.error(`Token transfer failed: ${error.message}`);
            throw error;
        }
    }

    async getBalance(owner) {
        try {
            // Check cache first
            const cachedBalance = await this.cache.get(`balance:${owner}`);
            if (cachedBalance) {
                return BigInt(cachedBalance);
            }

            const balance = await this.tokenProgram.account.tokenAccount.fetch(owner);
            
            // Cache balance
            await this.cache.setex(
                `balance:${owner}`,
                60, // 1 minute cache
                balance.toString()
            );

            return balance;
        } catch (error) {
            logger.error(`Balance check failed: ${error.message}`);
            throw error;
        }
    }

    async stake(owner, amount, duration) {
        try {
            const tx = await this.tokenProgram.methods
                .stake(amount, duration)
                .accounts({
                    owner,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .transaction();

            return await this.executeTransaction(tx, owner);
        } catch (error) {
            logger.error(`Staking failed: ${error.message}`);
            throw error;
        }
    }
}
