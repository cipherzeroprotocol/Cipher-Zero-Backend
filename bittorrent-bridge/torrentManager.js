const WebTorrent = require('webtorrent');
const { EventEmitter } = require('events');
const { ProofService } = require('../services/proofService');
const { FileProcessor } = require('./fileProcessor');
const { networkConfig } = require('../config');
const logger = require('../utils/logger');

class TorrentManager extends EventEmitter {
    constructor() {
        super();
        this.client = null;
        this.fileProcessor = new FileProcessor();
        this.proofService = new ProofService();
        this.activeTorrents = new Map();
        this.peerConnections = new Map();
        this.initialized = false;
    }

    /**
     * Initialize torrent manager
     */
    async initialize() {
        try {
            // Initialize WebTorrent client with enhanced settings
            this.client = new WebTorrent({
                tracker: {
                    announce: networkConfig.bittorrent.trackers,
                    getAnnounceOpts: () => ({
                        numWant: 50,
                        private: true
                    })
                },
                dht: networkConfig.bittorrent.dht,
                maxConns: networkConfig.bittorrent.maxConnections,
                uploadRateLimit: networkConfig.bittorrent.uploadRateLimit,
                downloadRateLimit: networkConfig.bittorrent.downloadRateLimit
            });

            // Setup event handlers
            this.setupEventHandlers();

            this.initialized = true;
            logger.info('TorrentManager initialized');
        } catch (error) {
            logger.error('TorrentManager initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create and seed new torrent
     */
    async createTorrent(fileData) {
        try {
            const {
                file,
                metadata,
                isPrivate = true,
                chunkSize = networkConfig.bittorrent.chunkSize
            } = fileData;

            // Process file
            const processedFile = await this.fileProcessor.processFile(file, {
                chunkSize,
                encrypt: isPrivate
            });

            // Create torrent
            return new Promise((resolve, reject) => {
                this.client.seed(processedFile.buffer, {
                    name: metadata.name,
                    comment: 'Shared via Cipher Zero Protocol',
                    private: isPrivate,
                    announceList: networkConfig.bittorrent.trackers,
                    pieceLength: chunkSize
                }, torrent => {
                    this.setupTorrentHandlers(torrent);
                    this.activeTorrents.set(torrent.infoHash, {
                        torrent,
                        metadata: {
                            ...metadata,
                            encryptionKey: processedFile.encryptionKey,
                            chunks: processedFile.chunks
                        }
                    });
                    resolve(this.formatTorrentInfo(torrent));
                }).on('error', reject);
            });

        } catch (error) {
            logger.error('Torrent creation failed:', error);
            throw error;
        }
    }

    /**
     * Download torrent
     */
    async downloadTorrent(downloadData) {
        try {
            const {
                infoHash,
                encryptionKey,
                savePath
            } = downloadData;

            return new Promise((resolve, reject) => {
                this.client.add(infoHash, {
                    path: savePath,
                    private: true,
                    strategy: 'rarest'
                }, async torrent => {
                    try {
                        this.setupTorrentHandlers(torrent);
                        this.activeTorrents.set(infoHash, {
                            torrent,
                            metadata: { encryptionKey }
                        });

                        // Wait for completion
                        const file = await this.waitForCompletion(torrent);
                        
                        // Decrypt if needed
                        const decryptedFile = encryptionKey
                            ? await this.fileProcessor.decryptFile(file, encryptionKey)
                            : file;

                        resolve(decryptedFile);

                    } catch (error) {
                        reject(error);
                    }
                }).on('error', reject);
            });

        } catch (error) {
            logger.error('Torrent download failed:', error);
            throw error;
        }
    }

    /**
     * Setup torrent event handlers
     */
    setupTorrentHandlers(torrent) {
        torrent.on('download', bytes => {
            this.emit('download:progress', {
                infoHash: torrent.infoHash,
                downloaded: torrent.downloaded,
                progress: torrent.progress,
                downloadSpeed: torrent.downloadSpeed
            });
        });

        torrent.on('upload', bytes => {
            this.emit('upload:progress', {
                infoHash: torrent.infoHash,
                uploaded: torrent.uploaded,
                ratio: torrent.ratio,
                uploadSpeed: torrent.uploadSpeed
            });
        });

        torrent.on('done', () => {
            this.emit('download:complete', {
                infoHash: torrent.infoHash
            });
        });

        torrent.on('warning', err => {
            logger.warn('Torrent warning:', err);
        });

        torrent.on('error', err => {
            logger.error('Torrent error:', err);
            this.emit('error', {
                infoHash: torrent.infoHash,
                error: err.message
            });
        });
    }

    /**
     * Setup global event handlers
     */
    setupEventHandlers() {
        this.client.on('error', error => {
            logger.error('WebTorrent error:', error);
            this.emit('error', { error: error.message });
        });

        this.client.on('peer', (peer, torrent) => {
            this.handleNewPeer(peer, torrent);
        });
    }

    /**
     * Handle new peer connection
     */
    async handleNewPeer(peer, torrent) {
        try {
            // Generate proof for peer
            const proof = await this.proofService.generatePeerProof(peer);
            
            // Verify peer
            const isValid = await this.verifyPeer(peer, proof);
            if (!isValid) {
                peer.destroy();
                return;
            }

            // Track peer connection
            this.peerConnections.set(peer.id, {
                peer,
                torrent: torrent.infoHash,
                connected: Date.now()
            });

            // Setup peer handlers
            this.setupPeerHandlers(peer);

            this.emit('peer:connected', {
                peerId: peer.id,
                torrent: torrent.infoHash
            });

        } catch (error) {
            logger.error('Peer handling failed:', error);
            peer.destroy();
        }
    }

    /**
     * Setup peer event handlers
     */
    setupPeerHandlers(peer) {
        peer.on('connect', () => {
            this.emit('peer:connect', { peerId: peer.id });
        });

        peer.on('disconnect', () => {
            this.peerConnections.delete(peer.id);
            this.emit('peer:disconnect', { peerId: peer.id });
        });

        peer.on('error', error => {
            logger.error('Peer error:', error);
            this.emit('peer:error', {
                peerId: peer.id,
                error: error.message
            });
        });
    }

    /**
     * Verify peer proof
     */
    async verifyPeer(peer, proof) {
        try {
            return await this.proofService.verifyPeerProof(proof);
        } catch (error) {
            logger.error('Peer verification failed:', error);
            return false;
        }
    }

    /**
     * Format torrent info
     */
    formatTorrentInfo(torrent) {
        return {
            infoHash: torrent.infoHash,
            magnetURI: torrent.magnetURI,
            name: torrent.name,
            length: torrent.length,
            pieceLength: torrent.pieceLength,
            lastPieceLength: torrent.lastPieceLength,
            pieces: torrent.pieces.length
        };
    }

    /**
     * Wait for torrent completion
     */
    waitForCompletion(torrent) {
        return new Promise((resolve, reject) => {
            if (torrent.done) {
                resolve(torrent.files[0]);
                return;
            }

            torrent.once('done', () => {
                resolve(torrent.files[0]);
            });

            torrent.once('error', reject);
        });
    }

    /**
     * Remove torrent
     */
    async removeTorrent(infoHash) {
        try {
            const torrentData = this.activeTorrents.get(infoHash);
            if (!torrentData) return;

            await new Promise((resolve, reject) => {
                torrentData.torrent.destroy({
                    destroyStore: true
                }, error => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            this.activeTorrents.delete(infoHash);

            logger.info('Torrent removed:', infoHash);
        } catch (error) {
            logger.error('Torrent removal failed:', error);
            throw error;
        }
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        try {
            // Remove all active torrents
            await Promise.all(
                Array.from(this.activeTorrents.keys())
                    .map(infoHash => this.removeTorrent(infoHash))
            );

            // Destroy client
            await new Promise((resolve, reject) => {
                this.client.destroy(error => {
                    if (error) reject(error);
                    else resolve();
                });
            });

            this.peerConnections.clear();
            logger.info('TorrentManager cleaned up');

        } catch (error) {
            logger.error('Cleanup failed:', error);
            throw error;
        }
    }
}

module.exports = new TorrentManager();