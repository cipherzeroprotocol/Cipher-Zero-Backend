// /neon-evm/adapters/fileRegistryAdapter.js
const Web3 = require('web3');
const { neonConfig, contractsConfig } = require('../../config');
const { ProofService } = require('../services/proofService');
const logger = require('../../utils/logger');

class FileRegistryAdapter {
    constructor(web3Instance = null) {
        this.web3 = web3Instance || new Web3(neonConfig.networks[neonConfig.network].url);
        this.contract = null;
        this.account = null;
        this.proofService = ProofService;
        this.retryCount = 0;
        this.MAX_RETRIES = 3;
        this.initialized = false;
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
                contractsConfig.abis.fileRegistry,
                contractsConfig.addresses[neonConfig.network].fileRegistry
            );

            this.initialized = true;
            logger.info('FileRegistry adapter initialized');

        } catch (error) {
            logger.error('FileRegistry adapter initialization failed:', error);
            throw error;
        }
    }

    /**
     * Store file metadata with proof
     */
    async storeFile(fileData) {
        try {
            const {
                fileHash,
                metadata,
                owner = this.account.address,
                isEncrypted = true
            } = fileData;

            // Generate proof for file storage
            const proof = await this.proofService.generateFileProof({
                fileHash,
                metadata,
                owner,
                isEncrypted
            });

            // Prepare transaction
            const tx = this.contract.methods.storeFile(
                fileHash,
                metadata,
                proof.proof,
                proof.publicSignals
            );

            // Send transaction
            const receipt = await this.sendTransaction(tx);

            logger.info('File stored successfully:', {
                fileHash,
                owner,
                transactionHash: receipt.transactionHash
            });

            return {
                transactionHash: receipt.transactionHash,
                fileHash,
                proof: proof.proof,
                commitment: proof.publicSignals[0]
            };

        } catch (error) {
            logger.error('Store file failed:', error);
            throw error;
        }
    }

    /**
     * Share file with another user
     */
    async shareFile(shareData) {
        try {
            const {
                fileHash,
                recipient,
                permissions = 'read',
                expiration = 0
            } = shareData;

            // Verify file ownership
            const isOwner = await this.isFileOwner(fileHash, this.account.address);
            if (!isOwner) {
                throw new Error('Not file owner');
            }

            // Generate proof for file sharing
            const proof = await this.proofService.generateFileProof({
                fileHash,
                recipient,
                permissions,
                expiration
            });

            // Prepare transaction
            const tx = this.contract.methods.shareFile(
                fileHash,
                recipient,
                permissions,
                expiration,
                proof.proof,
                proof.publicSignals
            );

            // Send transaction
            const receipt = await this.sendTransaction(tx);

            logger.info('File shared successfully:', {
                fileHash,
                recipient,
                permissions,
                transactionHash: receipt.transactionHash
            });

            return {
                transactionHash: receipt.transactionHash,
                proof: proof.proof,
                commitment: proof.publicSignals[0]
            };

        } catch (error) {
            logger.error('Share file failed:', error);
            throw error;
        }
    }

    /**
     * Revoke file access
     */
    async revokeAccess(revokeData) {
        try {
            const { fileHash, recipient } = revokeData;

            // Verify file ownership
            const isOwner = await this.isFileOwner(fileHash, this.account.address);
            if (!isOwner) {
                throw new Error('Not file owner');
            }

            // Prepare transaction
            const tx = this.contract.methods.revokeAccess(fileHash, recipient);

            // Send transaction
            const receipt = await this.sendTransaction(tx);

            logger.info('File access revoked:', {
                fileHash,
                recipient,
                transactionHash: receipt.transactionHash
            });

            return receipt;

        } catch (error) {
            logger.error('Revoke access failed:', error);
            throw error;
        }
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(fileHash) {
        try {
            const metadata = await this.contract.methods.getFileMetadata(fileHash).call();
            return this.parseFileMetadata(metadata);
        } catch (error) {
            logger.error('Get file metadata failed:', error);
            throw error;
        }
    }

    /**
     * Get user's files
     */
    async getUserFiles(userAddress, options = {}) {
        try {
            const {
                offset = 0,
                limit = 20,
                includeShared = true
            } = options;

            const files = await this.contract.methods
                .getUserFiles(userAddress, offset, limit, includeShared)
                .call();

            return files.map(this.parseFileMetadata);

        } catch (error) {
            logger.error('Get user files failed:', error);
            throw error;
        }
    }

    /**
     * Check file access
     */
    async checkAccess(fileHash, userAddress) {
        try {
            return await this.contract.methods
                .checkAccess(fileHash, userAddress)
                .call();
        } catch (error) {
            logger.error('Check access failed:', error);
            throw error;
        }
    }

    /**
     * Update file metadata
     */
    async updateMetadata(updateData) {
        try {
            const { fileHash, metadata } = updateData;

            // Verify file ownership
            const isOwner = await this.isFileOwner(fileHash, this.account.address);
            if (!isOwner) {
                throw new Error('Not file owner');
            }

            // Generate proof for metadata update
            const proof = await this.proofService.generateFileProof({
                fileHash,
                metadata,
                owner: this.account.address
            });

            // Prepare transaction
            const tx = this.contract.methods.updateMetadata(
                fileHash,
                metadata,
                proof.proof,
                proof.publicSignals
            );

            // Send transaction
            const receipt = await this.sendTransaction(tx);

            logger.info('Metadata updated:', {
                fileHash,
                transactionHash: receipt.transactionHash
            });

            return receipt;

        } catch (error) {
            logger.error('Update metadata failed:', error);
            throw error;
        }
    }

    /**
     * Delete file
     */
    async deleteFile(fileHash) {
        try {
            // Verify file ownership
            const isOwner = await this.isFileOwner(fileHash, this.account.address);
            if (!isOwner) {
                throw new Error('Not file owner');
            }

            // Prepare transaction
            const tx = this.contract.methods.deleteFile(fileHash);

            // Send transaction
            const receipt = await this.sendTransaction(tx);

            logger.info('File deleted:', {
                fileHash,
                transactionHash: receipt.transactionHash
            });

            return receipt;

        } catch (error) {
            logger.error('Delete file failed:', error);
            throw error;
        }
    }

    /**
     * Utility methods
     */
    async isFileOwner(fileHash, address) {
        try {
            const metadata = await this.getFileMetadata(fileHash);
            return metadata.owner.toLowerCase() === address.toLowerCase();
        } catch (error) {
            logger.error('File ownership check failed:', error);
            throw error;
        }
    }

    parseFileMetadata(metadata) {
        return {
            fileHash: metadata.fileHash,
            name: metadata.name,
            size: parseInt(metadata.size),
            mimeType: metadata.mimeType,
            owner: metadata.owner,
            isEncrypted: metadata.isEncrypted,
            timestamp: parseInt(metadata.timestamp),
            magnetLink: metadata.magnetLink || null,
            sharedWith: metadata.sharedWith || []
        };
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
}

module.exports = new FileRegistryAdapter();