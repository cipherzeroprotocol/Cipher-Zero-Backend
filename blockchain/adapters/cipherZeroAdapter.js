const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { Program } = require('@project-serum/anchor');
const { ethers } = require('ethers');
const { NeonEVM } = require('@neonevm/sdk');
const { CIPHER_ZERO_IDL } = require('../idl/cipherZero');
const { logger } = require('../../utils/logger');
const { metrics } = require('../../services/metrics');
const { redis } = require('../../services/redis');

class CipherZeroAdapter {
    constructor(connection, neonEvmUrl) {
        this.connection = connection;
        this.neonEvm = new NeonEVM(neonEvmUrl);
        this.cache = redis.getClient();
        
        // Initialize programs and contracts
        this.initializeContracts();
        
        // Bind methods
        this.executeTransaction = this.executeTransaction.bind(this);
    }

    async initializeContracts() {
        try {
            // Initialize Solana program
            this.program = new Program(
                CIPHER_ZERO_IDL,
                new PublicKey(process.env.CIPHER_ZERO_PROGRAM_ID),
                this.connection
            );

            // Initialize Neon EVM contract
            const cipherZeroAbi = require('../abi/CipherZeroCore.json');
            this.evmContract = new ethers.Contract(
                process.env.CIPHER_ZERO_EVM_ADDRESS,
                cipherZeroAbi,
                this.neonEvm.provider
            );

            logger.info('CipherZero contracts initialized successfully');
        } catch (error) {
            logger.error(`Contract initialization failed: ${error.message}`);
            throw error;
        }
    }

    async initializeUser(userPublicKey, zkProof) {
        const startTime = Date.now();
        try {
            // Verify user hasn't been initialized
            const isInitialized = await this.program.account.userAccount.fetch(userPublicKey);
            if (isInitialized) {
                throw new Error('User already initialized');
            }

            // Create initialization transaction
            const tx = await this.program.methods
                .initializeUser(zkProof)
                .accounts({
                    user: userPublicKey,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Execute transaction
            const result = await this.executeTransaction(tx, userPublicKey);
            
            metrics.userInitialized(Date.now() - startTime);
            
            return result;
        } catch (error) {
            metrics.userInitializationFailed(error.name);
            throw error;
        }
    }

    async processDataTransfer(sender, recipient, dataHash, zkProof) {
        try {
            // Verify data hasn't been processed
            const isProcessed = await this.cache.get(`transfer:${dataHash}`);
            if (isProcessed) {
                throw new Error('Data transfer already processed');
            }

            // Create data transfer transaction
            const tx = await this.program.methods
                .processDataTransfer(recipient, dataHash, zkProof)
                .accounts({
                    sender,
                    recipient,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Execute transaction
            const result = await this.executeTransaction(tx, sender);
            
            // Cache transfer
            await this.cache.setex(`transfer:${dataHash}`, 3600, 'processed');
            
            return result;
        } catch (error) {
            logger.error(`Data transfer failed: ${error.message}`);
            throw error;
        }
    }

    async verifyDataIntegrity(dataHash, zkProof) {
        try {
            // Check cache first
            const cachedResult = await this.cache.get(`integrity:${dataHash}`);
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }

            // Verify on EVM contract
            const result = await this.evmContract.verifyDataIntegrity(
                dataHash,
                zkProof
            );

            // Cache result
            await this.cache.setex(
                `integrity:${dataHash}`,
                1800,
                JSON.stringify(result)
            );

            return result;
        } catch (error) {
            logger.error(`Integrity verification failed: ${error.message}`);
            throw error;
        }
    }

    async executeTransaction(transaction, signer) {
        const startTime = Date.now();
        try {
            // Add recent blockhash
            transaction.recentBlockhash = (
                await this.connection.getRecentBlockhash()
            ).blockhash;

            // Sign transaction
            transaction.feePayer = new PublicKey(signer);
            const signedTx = await transaction.sign(signer);

            // Send transaction
            const txId = await this.connection.sendRawTransaction(
                signedTx.serialize()
            );

            // Confirm transaction
            await this.connection.confirmTransaction(txId);

            metrics.transactionExecuted(Date.now() - startTime);

            return {
                success: true,
                transactionId: txId,
                timestamp: Date.now()
            };
        } catch (error) {
            metrics.transactionFailed(error.name);
            throw error;
        }
    }
}