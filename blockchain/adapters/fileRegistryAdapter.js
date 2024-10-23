class FileRegistryAdapter {
    constructor(connection, neonEvmUrl) {
        this.connection = connection;
        this.neonEvm = new NeonEVM(neonEvmUrl);
        this.cache = redis.getClient();
        
        // Initialize registry contracts
        this.initializeContracts();
    }

    async initializeContracts() {
        try {
            // Initialize Solana program
            this.program = new Program(
                require('../idl/fileRegistry.json'),
                new PublicKey(process.env.FILE_REGISTRY_PROGRAM_ID),
                this.connection
            );

            // Initialize Neon EVM contract
            const registryAbi = require('../abi/FileRegistry.json');
            this.evmContract = new ethers.Contract(
                process.env.FILE_REGISTRY_EVM_ADDRESS,
                registryAbi,
                this.neonEvm.provider
            );

            logger.info('FileRegistry contracts initialized successfully');
        } catch (error) {
            logger.error(`Registry contract initialization failed: ${error.message}`);
            throw error;
        }
    }

    async registerFile(owner, fileHash, metadata, zkProof) {
        try {
            // Verify file hasn't been registered
            const isRegistered = await this.isFileRegistered(fileHash);
            if (isRegistered) {
                throw new Error('File already registered');
            }

            // Create registration transaction
            const tx = await this.program.methods
                .registerFile(fileHash, metadata, zkProof)
                .accounts({
                    owner,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Execute transaction
            const result = await this.executeTransaction(tx, owner);
            
            // Index metadata
            await this.indexFileMetadata(fileHash, metadata);
            
            return result;
        } catch (error) {
            logger.error(`File registration failed: ${error.message}`);
            throw error;
        }
    }

    async updateFileMetadata(owner, fileHash, newMetadata, zkProof) {
        try {
            // Verify file ownership
            const isOwner = await this.verifyFileOwnership(owner, fileHash);
            if (!isOwner) {
                throw new Error('Not file owner');
            }

            // Create update transaction
            const tx = await this.program.methods
                .updateFileMetadata(fileHash, newMetadata, zkProof)
                .accounts({
                    owner,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Execute transaction
            const result = await this.executeTransaction(tx, owner);
            
            // Update metadata index
            await this.indexFileMetadata(fileHash, newMetadata);
            
            return result;
        } catch (error) {
            logger.error(`Metadata update failed: ${error.message}`);
            throw error;
        }
    }

    async transferFileOwnership(currentOwner, newOwner, fileHash, zkProof) {
        try {
            // Verify current ownership
            const isOwner = await this.verifyFileOwnership(currentOwner, fileHash);
            if (!isOwner) {
                throw new Error('Not file owner');
            }

            // Create transfer transaction
            const tx = await this.program.methods
                .transferFileOwnership(newOwner, fileHash, zkProof)
                .accounts({
                    currentOwner,
                    newOwner,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Execute transaction
            return await this.executeTransaction(tx, currentOwner);
        } catch (error) {
            logger.error(`Ownership transfer failed: ${error.message}`);
            throw error;
        }
    }

    async getFileMetadata(fileHash) {
        try {
            // Check cache first
            const cachedMetadata = await this.cache.get(`file:${fileHash}`);
            if (cachedMetadata) {
                return JSON.parse(cachedMetadata);
            }

            // Fetch from blockchain
            const metadata = await this.program.account.fileAccount.fetch(fileHash);
            
            // Cache result
            await this.cache.setex(
                `file:${fileHash}`,
                3600,
                JSON.stringify(metadata)
            );

            return metadata;
        } catch (error) {
            logger.error(`Metadata fetch failed: ${error.message}`);
            throw error;
        }
    }

    async isFileRegistered(fileHash) {
        try {
            const metadata = await this.getFileMetadata(fileHash);
            return !!metadata;
        } catch (error) {
            return false;
        }
    }

    async verifyFileOwnership(owner, fileHash) {
        try {
            const metadata = await this.getFileMetadata(fileHash);
            return metadata.owner.equals(new PublicKey(owner));
        } catch (error) {
            return false;
        }
    }

    async indexFileMetadata(fileHash, metadata) {
        try {
            // Index metadata for searching
            await this.cache.hset(
                'file_index',
                fileHash,
                JSON.stringify(metadata)
            );
        } catch (error) {
            logger.error(`Metadata indexing failed: ${error.message}`);
        }
    }
}

module.exports = {
    CipherZeroAdapter,
    FileRegistryAdapter
};