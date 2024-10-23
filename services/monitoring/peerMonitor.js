class PeerMonitor extends EventEmitter {
    constructor(peerStatsDao) {
        super();
        this.peerStatsDao = peerStatsDao;
        this.activePeers = new Map();
        this.monitoringInterval = null;
        this.MONITOR_INTERVAL = 10000; // 10 seconds
    }
 
    /**
     * Start peer monitoring
     */
    start() {
        this.monitoringInterval = setInterval(
            () => this.monitorPeers(),
            this.MONITOR_INTERVAL
        );
        logger.info('Peer monitoring started');
    }
 
    /**
     * Stop peer monitoring
     */
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        logger.info('Peer monitoring stopped');
    }
 
    /**
     * Monitor peer behavior
     */
    async monitorPeers() {
        try {
            for (const [peerId, peer] of this.activePeers) {
                const peerStats = await this.analyzePeerBehavior(peer);
                await this.peerStatsDao.updatePeerStats(peerId, peerStats);
 
                // Check for suspicious behavior
                if (peerStats.suspicious) {
                    await this.handleSuspiciousPeer(peer, peerStats);
                }
            }
        } catch (error) {
            logger.error('Peer monitoring failed:', error);
        }
    }
 
    /**
     * Analyze peer behavior
     */
    async analyzePeerBehavior(peer) {
        const stats = {
            uploadSpeed: peer.getUploadSpeed(),
            downloadSpeed: peer.getDownloadSpeed(),
            connected: peer.isConnected(),
            lastSeen: peer.getLastSeen(),
            suspicious: false,
            issues: []
        };
 
        // Check bandwidth ratio
        const ratio = stats.uploadSpeed / (stats.downloadSpeed || 1);
        if (ratio < 0.1) {
            stats.issues.push('low_upload_ratio');
        }
 
        // Check connection stability
        const disconnects = peer.getDisconnectCount();
        if (disconnects > 5) {
            stats.issues.push('frequent_disconnects');
        }
 
        // Check data validity
        const invalidData = peer.getInvalidDataCount();
        if (invalidData > 0) {
            stats.issues.push('invalid_data');
            stats.suspicious = true;
        }
 
        // Check message spam
        const messageRate = peer.getMessageRate();
        if (messageRate > 100) { // 100 messages per second
            stats.issues.push('message_spam');
            stats.suspicious = true;
        }
 
        return stats;
    }
 
    /**
     * Handle suspicious peer
     */
    async handleSuspiciousPeer(peer, stats) {
        logger.warn(`Suspicious peer detected: ${peer.id}`, stats);
 
        // Emit event
        events.emit(EventTypes.PEER.SUSPICIOUS, {
            peerId: peer.id,
            issues: stats.issues
        });
 
        // Update peer reputation
        await this.peerStatsDao.updateReliability(peer.id, false);
 
        // Ban peer if necessary
        if (this.shouldBanPeer(stats)) {
            await this.banPeer(peer);
        }
    }
 
    /**
     * Check if peer should be banned
     */
    shouldBanPeer(stats) {
        // Ban criteria
        return stats.issues.includes('invalid_data') &&
               stats.issues.length >= 3;
    }
 
    /**
     * Ban peer
     */
    async banPeer(peer) {
        logger.warn(`Banning peer: ${peer.id}`);
        
        // Remove from active peers
        this.activePeers.delete(peer.id);
        
        // Disconnect peer
        await peer.disconnect();
        
        // Add to ban list
        await this.peerStatsDao.updatePeerStats(peer.id, {
            banned: true,
            banReason: 'Suspicious behavior',
            banTime: Date.now()
        });
 
        events.emit(EventTypes.PEER.BANNED, {
            peerId: peer.id
        });
    }
 
    /**
     * Add peer for monitoring
     */
    addPeer(peer) {
        this.activePeers.set(peer.id, peer);
    }
 
    /**
     * Remove peer from monitoring
     */
    removePeer(peerId) {
        this.activePeers.delete(peerId);
    }
 }
 
 module.exports = {
    NetworkMonitor,
    PeerMonitor
 };