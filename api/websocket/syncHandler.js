class SyncHandler {
    constructor(io, chainService) {
        this.io = io;
        this.chainService = chainService;
        this.syncStatus = new Map();
    }

    initialize() {
        this.io.on('connection', (socket) => {
            socket.on('subscribe_sync', async () => {
                try {
                    await this.handleSyncSubscription(socket);
                } catch (error) {
                    logger.error('Sync subscription failed:', error);
                    socket.emit('sync_error', { message: error.message });
                }
            });
        });

        // Start periodic sync status updates
        this.startSyncMonitoring();
    }

    async handleSyncSubscription(socket) {
        const userAddress = socket.user.address;
        this.syncStatus.set(userAddress, {
            lastBlock: await this.chainService.getLatestBlock(),
            syncPercentage: 100,
            status: 'synced'
        });

        // Send initial status
        socket.emit('sync_status', this.syncStatus.get(userAddress));
    }

    async startSyncMonitoring() {
        setInterval(async () => {
            try {
                const latestBlock = await this.chainService.getLatestBlock();
                const networkStatus = await this.chainService.getNetworkStatus();

                // Update all subscribed clients
                for (const [userAddress, status] of this.syncStatus) {
                    const socket = this.userSockets.get(userAddress);
                    if (socket) {
                        const updatedStatus = this.calculateSyncStatus(
                            status.lastBlock,
                            latestBlock,
                            networkStatus
                        );

                        this.syncStatus.set(userAddress, updatedStatus);
                        socket.emit('sync_status', updatedStatus);
                    }
                }
            } catch (error) {
                logger.error('Sync monitoring failed:', error);
            }
        }, 5000); // Update every 5 seconds
    }

    calculateSyncStatus(lastBlock, currentBlock, networkStatus) {
        const behind = currentBlock - lastBlock;
        const syncPercentage = Math.min(100, (lastBlock / currentBlock) * 100);

        return {
            lastBlock,
            currentBlock,
            behind,
            syncPercentage,
            status: behind === 0 ? 'synced' : 'syncing',
            networkStatus
        };
    }
}

module.exports = {
    RoomHandler,
    FileTransferHandler,
    SyncHandler
};