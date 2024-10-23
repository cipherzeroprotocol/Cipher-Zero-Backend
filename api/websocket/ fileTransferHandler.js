class FileTransferHandler {
    constructor(io, fileService, torrentService) {
        this.io = io;
        this.fileService = fileService;
        this.torrentService = torrentService;
        this.transfers = new Map();
    }

    initialize() {
        this.io.on('connection', (socket) => {
            socket.on('start_transfer', async (data) => {
                try {
                    await this.initializeTransfer(socket, data);
                } catch (error) {
                    logger.error('Transfer initialization failed:', error);
                    socket.emit('transfer_error', { message: error.message });
                }
            });

            socket.on('transfer_progress', async (data) => {
                try {
                    await this.updateTransferProgress(socket, data);
                } catch (error) {
                    logger.error('Progress update failed:', error);
                }
            });
        });
    }

    async initializeTransfer(socket, data) {
        const { fileHash, recipient, metadata } = data;

        // Create transfer tracking
        const transferId = uuidv4();
        this.transfers.set(transferId, {
            fileHash,
            sender: socket.user.address,
            recipient,
            status: 'initializing',
            progress: 0,
            startTime: Date.now()
        });

        // Initialize torrent
        const magnetLink = await this.torrentService.createTorrent(fileHash, metadata);

        // Notify recipient
        const recipientSocket = this.userSockets.get(recipient);
        if (recipientSocket) {
            recipientSocket.emit('transfer_started', {
                transferId,
                sender: socket.user.address,
                magnetLink,
                metadata
            });
        }

        socket.emit('transfer_initialized', { transferId, magnetLink });
    }

    async updateTransferProgress(socket, data) {
        const { transferId, progress } = data;
        const transfer = this.transfers.get(transferId);

        if (transfer) {
            transfer.progress = progress;
            transfer.status = progress === 100 ? 'completed' : 'in_progress';

            // Notify participants
            this.io.to(transfer.recipient).emit('transfer_progress', {
                transferId,
                progress,
                status: transfer.status
            });
        }
    }
}