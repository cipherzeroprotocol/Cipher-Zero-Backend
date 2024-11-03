// /neon-evm/adapters/torrentAdapter.js
const Web3 = require('web3');
const WebTorrent = require('webtorrent');
const { neonConfig, contractsConfig, networkConfig } = require('../../config');
const { ProofService } = require('../services/proofService');
const { encryptFile, decryptFile } = require('../utils/fileEncryption');
const logger = require('../../utils/logger');

class TorrentAdapter {
    constructor(web3Instance = null) {
        this.web3 = web3Instance || new Web3(neonConfig.networks[neonConfig.network].url);
        this.contract = null;
        this.account = null;
        this.proofService = ProofService;
        this.client = null;
        this.activeTorrents = new Map();
        this.fileCache = new Map();
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

            // Initialize BitTorrent contract
            this.contract = new this.web3.eth.Contract(
                contractsConfig.abis.bitTorrent,
                contractsConfig.addresses[neonConfig.network].bitTorrent
            );

            // Initialize WebTorrent client
            this.client = new WebTorrent({
                tracker: networkConfig.bittorrent.trackers,
                dht: networkConfig.bittorrent.dht
            });

            // Setup event handlers
            this.setupEventHandlers();

            this.initialized = true;
            logger.info('BitTorrent adapter initialized');

        } catch (error) {
            logger.error('BitTorrent adapter initialization failed:', error);
            throw error;
        }
    }

    /**
     * Upload file to BitTorrent network
     */
    async uploadFile(fileData) {
        try {
            const {
                file,
                metadata,
                isPrivate = true,
                recipients = []
            } = fileData;

            // Generate encryption key if private
            const encryptionKey = isPrivate ? await this.generateEncryptionKey() : null;

            // Encrypt file if private
            const processedFile = isPrivate 
                ? await encryptFile(file, encryptionKey)
                : file;

            // Create torrent
            const torrent = await this.createTorrent(processedFile);

            // Generate proof
            const proof = await this.proofService.generateFileProof({
                fileHash: torrent.infoHash,
                metadata,
                owner: this.account.address,
                isPrivate
            });

            // Store on-chain
            const tx = this.contract.methods.registerTorrent(
                torrent.infoHash,
                metadata,
                isPrivate,
                recipients,
                proof.proof,
                proof.publicSignals
            );

            const receipt = await this.sendTransaction(tx);

            // Track torrent
            this.activeTorrents.set(torrent.infoHash, {
                torrent,
                encryptionKey,
                metadata,
                isPrivate
            });

            logger.info('File uploaded:', {
                infoHash: torrent.infoHash,
                isPrivate,
                transactionHash: receipt.transactionHash
            });

            return {
                infoHash: torrent.infoHash,
                magnetLink: torrent.magnetURI,
                encryptionKey: isPrivate ? encryptionKey : null,
                transactionHash: receipt.transactionHash
            };

        } catch (error) {
            logger.error('File upload failed:', error);
            throw error;
        }
    }

    /**
     * Download file from BitTorrent network
     */
    async downloadFile(downloadData) {
        try {
            const {
                infoHash,
                encryptionKey = null
            } = downloadData;

            // Verify access
            const hasAccess = await this.checkAccess(infoHash);
            if (!hasAccess) {
                throw new Error('No access to file');
            }

            // Check if file is already being downloaded
            if (this.activeTorrents.has(infoHash)) {
                return this.activeTorrents.get(infoHash).torrent;
            }

            return new Promise((resolve, reject) => {
                this.client.add(infoHash, { 
                    path: networkConfig.bittorrent.downloadPath 
                }, async (torrent) => {
                    try {
                        // Track torrent
                        this.activeTorrents.set(infoHash, {
                            torrent,
                            encryptionKey
                        });

                        // Wait for completion
                        torrent.on('done', async () => {
                            try {
                                // Decrypt if needed
                                const file = encryptionKey 
                                    ? await decryptFile(torrent.files[0], encryptionKey)
                                    : torrent.files[0];

                                resolve(file);
                            } catch (error) {
                                reject(error);
                            }
                        });

                    } catch (error) {
                        reject(error);
                    }
                });
            });

        } catch (error) {
            logger.error('File download failed:', error);
            throw error;
        }
    }

    /**
     * Share file with recipients
     */
    async shareFile(shareData) {
        try {
            const {
                infoHash,
                recipients,
                encryptionKey = null
            } = shareData;

            // Verify ownership
            const isOwner = await this.isFileOwner(infoHash);
            if (!isOwner) {
                throw new Error('Not file owner');
            }

            // Generate proof
            const proof = await this.proofService.generateFileProof({
                fileHash: infoHash,
                recipients,
                owner: this.account.address
            });

            // Share on-chain
            const tx = this.contract.methods.shareTorrent(
                infoHash,
                recipients,
                encryptionKey ? true : false,
                proof.proof,
                proof.publicSignals
            );

            const receipt = await this.sendTransaction(tx);

            logger.info('File shared:', {
                infoHash,
                recipients,
                transactionHash: receipt.transactionHash
            });

            return receipt;

        } catch (error) {
            logger.error('File sharing failed:', error);
            throw error;
        }
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(infoHash) {
        try {
            return await this.contract.methods
                .getTorrentMetadata(infoHash)
                .call();
        } catch (error) {
            logger.error('Get file metadata failed:', error);
            throw error;
        }
    }

    /**
     * Check file access
     */
    async checkAccess(infoHash) {
        try {
            return await this.contract.methods
                .checkAccess(infoHash, this.account.address)
                .call();
        } catch (error) {
            logger.error('Check access failed:', error);
            throw error;
        }
    }

    /**
     * Create torrent from file
     */
    async createTorrent(file) {
        return new Promise((resolve, reject) => {
            this.client.seed(file, {
                announceList: networkConfig.bittorrent.trackers,
                private: true,
                comment: 'Uploaded via Cipher Zero Protocol'
            }, (torrent) => {
                resolve(torrent);
            }).on('error', reject);
        });
    }

    /**
     * Setup WebTorrent event handlers
     */
    setupEventHandlers() {
        this.client.on('error', (error) => {
            logger.error('WebTorrent error:', error);
        });

        this.client.on('torrent', (torrent) => {
            torrent.on('download', (bytes) => {
                this.emit('download:progress', {
                    infoHash: torrent.infoHash,
                    downloaded: torrent.downloaded,
                    progress: torrent.progress
                });
            });

            torrent.on('upload', (bytes) => {
                this.emit('upload:progress', {
                    infoHash: torrent.infoHash,
                    uploaded: torrent.uploaded,
                    progress: torrent.progress
                });
            });

            torrent.on('done', () => {
                this.emit('download:complete', {
                    infoHash: torrent.infoHash
                });
            });

            torrent.on('wire', (wire) => {
                this.emit('peer:connected', {
                    infoHash: torrent.infoHash,
                    peerId: wire.peerId
                });
            });
        });
    }

    /**
     * Generate encryption key
     */
    async generateEncryptionKey() {
        return this.web3.utils.randomHex(32);
    }

    /**
     * Check if user is file owner
     */
    async isFileOwner(infoHash) {
        try {
            const metadata = await this.getFileMetadata(infoHash);
            return metadata.owner.toLowerCase() === this.account.address.toLowerCase();
        } catch (error) {
            logger.error('Owner check failed:', error);
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
    async cleanup() {
        try {
            // Remove all torrents
            for (const [infoHash, data] of this.activeTorrents) {
                await new Promise((resolve) => {
                    data.torrent.destroy({ destroyStore: true }, resolve);
                });
                this.activeTorrents.delete(infoHash);
            }

            // Destroy client
            await new Promise((resolve) => {
                this.client.destroy(resolve);
            });

            this.fileCache.clear();
            logger.info('BitTorrent adapter cleaned up');

        } catch (error) {
            logger.error('Cleanup failed:', error);
            throw error;
        }
    }
}

module.exports = new TorrentAdapter();