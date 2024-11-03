const { EventEmitter } = require('events');
const { TransferQueue } = require('../queue/transferQueue');
const { TorrentAdapter } = require('../../neon-evm/adapters/torrentAdapter');
const logger = require('../../utils/logger');

class FileTransferHandler extends EventEmitter {
    constructor(io) {
        super();
        this.io = io;
        this.transferQueue = new TransferQueue();
        this.torrentAdapter = TorrentAdapter;
        this.activeTransfers = new Map();
        this.CHUNK_SIZE = 1024 * 1024; // 1MB chunks
    }

    /**
     * Initialize handler
     */
    async initialize() {
        this.setupSocketHandlers();
        await this.transferQueue.initialize();
        logger.info('FileTransferHandler initialized');
    }

    /**
     * Setup socket handlers
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            // Upload handlers
            socket.on('upload:start', async (data) => {
                try {
                    await this.handleUploadStart(socket, data);
                } catch (error) {
                    this.sendError(socket, 'upload:error', error);
                }
            });

            socket.on('upload:chunk', async (data) => {
                try {
                    await this.handleUploadChunk(socket, data);
                } catch (error) {
                    this.sendError(socket, 'upload:error', error);
                }
            });

            // Download handlers
            socket.on('download:start', async (data) => {
                try {
                    await this.handleDownloadStart(socket, data);
                } catch (error) {
                    this.sendError(socket, 'download:error', error);
                }
            });

            socket.on('download:request-chunk', async (data) => {
                try {
                    await this.handleChunkRequest(socket, data);
                } catch (error) {
                    this.sendError(socket, 'download:error', error);
                }
            });

            // Cleanup on disconnect
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    /**
     * Handle upload start
     */
    async handleUploadStart(socket, data) {
        const { file, metadata, isPrivate, recipients } = data;
        
        // Create transfer session
        const sessionId = this.generateSessionId();
        const transfer = {
            id: sessionId,
            file: {
                size: file.size,
                name: file.name,
                type: file.type
            },
            metadata,
            isPrivate,
            recipients,
            chunks: new Map(),
            progress: 0
        };

        this.activeTransfers.set(sessionId, transfer);

        // Add to queue
        const job = await this.transferQueue.addUpload({
            sessionId,
            metadata,
            isPrivate,
            recipients
        });

        // Send session info back
        socket.emit('upload:initialized', {
            sessionId,
            chunkSize: this.CHUNK_SIZE,
            totalChunks: Math.ceil(file.size / this.CHUNK_SIZE)
        });

        logger.info('Upload started:', { sessionId, filename: file.name });
    }

    /**
     * Handle upload chunk
     */
    async handleUploadChunk(socket, data) {
        const { sessionId, chunk, index, total } = data;
        const transfer = this.activeTransfers.get(sessionId);

        if (!transfer) {
            throw new Error('Transfer session not found');
        }

        // Store chunk
        transfer.chunks.set(index, chunk);
        transfer.progress = (transfer.chunks.size / total) * 100;

        // Emit progress
        socket.emit('upload:progress', {
            sessionId,
            progress: transfer.progress,
            chunksReceived: transfer.chunks.size,
            totalChunks: total
        });

        // Check if upload is complete
        if (transfer.chunks.size === total) {
            await this.finalizeUpload(socket, sessionId);
        }
    }

    /**
     * Finalize upload
     */
    async finalizeUpload(socket, sessionId) {
        const transfer = this.activeTransfers.get(sessionId);

        try {
            // Combine chunks
            const fileData = this.combineChunks(transfer.chunks);

            // Upload to BitTorrent network
            const result = await this.torrentAdapter.uploadFile({
                file: fileData,
                metadata: transfer.metadata,
                isPrivate: transfer.isPrivate,
                recipients: transfer.recipients
            });

            // Clean up
            this.activeTransfers.delete(sessionId);

            // Notify success
            socket.emit('upload:completed', {
                sessionId,
                infoHash: result.infoHash,
                magnetLink: result.magnetLink
            });

            logger.info('Upload completed:', { 
                sessionId,
                infoHash: result.infoHash 
            });

        } catch (error) {
            logger.error('Upload finalization failed:', error);
            throw error;
        }
    }

    /**
     * Handle download start
     */
    async handleDownloadStart(socket, data) {
        const { infoHash, encryptionKey } = data;

        // Create transfer session
        const sessionId = this.generateSessionId();
        const transfer = {
            id: sessionId,
            infoHash,
            encryptionKey,
            chunks: new Map(),
            progress: 0
        };

        this.activeTransfers.set(sessionId, transfer);

        // Add to queue
        const job = await this.transferQueue.addDownload({
            sessionId,
            infoHash,
            encryptionKey
        });

        // Initialize download from BitTorrent
        const torrent = await this.torrentAdapter.downloadFile({
            infoHash,
            encryptionKey
        });

        // Send session info
        socket.emit('download:initialized', {
            sessionId,
            fileSize: torrent.length,
            chunkSize: this.CHUNK_SIZE,
            totalChunks: Math.ceil(torrent.length / this.CHUNK_SIZE)
        });

        logger.info('Download started:', { sessionId, infoHash });
    }

    /**
     * Handle chunk request
     */
    async handleChunkRequest(socket, data) {
        const { sessionId, index } = data;
        const transfer = this.activeTransfers.get(sessionId);

        if (!transfer) {
            throw new Error('Transfer session not found');
        }

        // Get chunk from torrent
        const chunk = await this.torrentAdapter.getChunk(
            transfer.infoHash,
            index,
            this.CHUNK_SIZE
        );

        // Send chunk
        socket.emit('download:chunk', {
            sessionId,
            chunk,
            index
        });

        // Update progress
        transfer.chunks.set(index, true);
        transfer.progress = (transfer.chunks.size / transfer.totalChunks) * 100;

        socket.emit('download:progress', {
            sessionId,
            progress: transfer.progress,
            chunksReceived: transfer.chunks.size,
            totalChunks: transfer.totalChunks
        });

        // Check if download is complete
        if (transfer.chunks.size === transfer.totalChunks) {
            this.finalizeDownload(socket, sessionId);
        }
    }

    /**
     * Finalize download
     */
    async finalizeDownload(socket, sessionId) {
        const transfer = this.activeTransfers.get(sessionId);

        // Clean up
        this.activeTransfers.delete(sessionId);

        // Notify success
        socket.emit('download:completed', {
            sessionId,
            infoHash: transfer.infoHash
        });

        logger.info('Download completed:', { 
            sessionId,
            infoHash: transfer.infoHash 
        });
    }

    /**
     * Handle disconnect
     */
    handleDisconnect(socket) {
        // Clean up any active transfers for this socket
        for (const [sessionId, transfer] of this.activeTransfers) {
            if (transfer.socketId === socket.id) {
                this.activeTransfers.delete(sessionId);
            }
        }
    }

    /**
     * Send error to client
     */
    sendError(socket, event, error) {
        socket.emit(event, {
            error: error.message
        });
        logger.error(error);
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Combine chunks into file
     */
    combineChunks(chunks) {
        const sortedChunks = Array.from(chunks.entries())
            .sort(([a], [b]) => a - b)
            .map(([_, chunk]) => chunk);

        return Buffer.concat(sortedChunks);
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        this.activeTransfers.clear();
        await this.transferQueue.cleanup();
    }
}
