// messagingAdapter.js
const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { Program } = require('@project-serum/anchor');
const { NeonEVM } = require('@neonevm/sdk');
const { encryptMessage, decryptMessage } = require('../../utils/encryption');
const { logger } = require('../../utils/logger');
const { metrics } = require('../../services/metrics');
const { redis } = require('../../services/redis');

class MessagingAdapter {
    constructor(connection, neonEvmUrl) {
        this.connection = connection;
        this.neonEvm = new NeonEVM(neonEvmUrl);
        this.cache = redis.getClient();
        
        this.initializeContracts();
    }

    async initializeContracts() {
        try {
            // Initialize Solana program
            this.program = new Program(
                require('../idl/messaging.json'),
                new PublicKey(process.env.MESSAGING_PROGRAM_ID),
                this.connection
            );

            // Initialize Neon EVM contract
            const messagingAbi = require('../abi/Messaging.json');
            this.evmContract = new ethers.Contract(
                process.env.MESSAGING_EVM_ADDRESS,
                messagingAbi,
                this.neonEvm.provider
            );

            logger.info('Messaging contracts initialized successfully');
        } catch (error) {
            logger.error(`Messaging contract initialization failed: ${error.message}`);
            throw error;
        }
    }

    async sendMessage(sender, recipient, content, zkProof) {
        const startTime = Date.now();
        try {
            // Encrypt message content
            const encryptedContent = await encryptMessage(content, recipient);

            // Create message transaction
            const tx = await this.program.methods
                .sendMessage(recipient, encryptedContent, zkProof)
                .accounts({
                    sender,
                    recipient,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Execute transaction
            const result = await this.executeTransaction(tx, sender);
            
            metrics.messageSent(Date.now() - startTime);
            
            return result;
        } catch (error) {
            metrics.messageFailed(error.name);
            throw error;
        }
    }

    async getMessages(recipient, lastMessageId = null) {
        try {
            // Get messages from chain
            const messages = await this.program.account.messageAccount.all([
                {
                    memcmp: {
                        offset: 8,
                        bytes: recipient.toBase58(),
                    },
                },
            ]);

            // Filter and decrypt messages
            const decryptedMessages = await Promise.all(
                messages
                    .filter(msg => !lastMessageId || msg.account.id > lastMessageId)
                    .map(async msg => ({
                        id: msg.account.id,
                        sender: msg.account.sender,
                        content: await decryptMessage(msg.account.content, recipient),
                        timestamp: msg.account.timestamp,
                    }))
            );

            return decryptedMessages;
        } catch (error) {
            logger.error(`Message retrieval failed: ${error.message}`);
            throw error;
        }
    }

    async deleteMessage(messageId, owner, zkProof) {
        try {
            const tx = await this.program.methods
                .deleteMessage(messageId, zkProof)
                .accounts({
                    owner,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            return await this.executeTransaction(tx, owner);
        } catch (error) {
            logger.error(`Message deletion failed: ${error.message}`);
            throw error;
        }
    }
}