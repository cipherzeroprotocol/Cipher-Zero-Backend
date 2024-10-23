const BitTorrent = require('../../services/bitTorrent');
const { NetworkValidator } = require('../../validation/networkValidator');
const { metrics } = require('../../services/metrics');

class PeerController {
    constructor(connection) {
        this.connection = connection;
        this.bitTorrent = new BitTorrent();
        this.networkValidator = new NetworkValidator(connection);
        this.activePeers = new Map();
        
        // Initialize peer monitoring
        this.initializePeerMonitoring();
    }

    async registerPeer(req, res) {
        const startTime = Date.now();
        try {
            const { peerId, nodeInfo, capabilities } = req.body;

            // Validate peer information
            if (!this.networkValidator.validatePeerInfo(nodeInfo)) {
                throw new CipherZeroError('Invalid peer information', 400);
            }

            // Verify node capabilities
            const verifiedCapabilities = await this.networkValidator.verifyNodeCapabilities(
                peerId,
                capabilities
            );

            // Register peer
            const peerData = {
                nodeInfo,
                capabilities: verifiedCapabilities,
                joinedAt: Date.now(),
                lastSeen: Date.now(),
                status: 'active'
            };

            this.activePeers.set(peerId, peerData);
            
            // Record metrics
            metrics.peerRegistered(Date.now() - startTime);

            res.status(200).json({
                success: true,
                peerId,
                networkInfo: await this.getNetworkInfo()
            });
        } catch (error) {
            logger.error(`Peer registration failed: ${error.message}`);
            metrics.peerRegistrationFailed(error.name);
            
            res.status(error.status || 500).json({
                success: false,
                error: error.message
            });
        }
    }

    async disconnectPeer(req, res) {
        try {
            const { peerId } = req.params;

            if (!this.activePeers.has(peerId)) {
                throw new CipherZeroError('Peer not found', 404);
            }

            // Update peer status
            const peerData = this.activePeers.get(peerId);
            peerData.status = 'disconnected';
            peerData.disconnectedAt = Date.now();
            
            this.activePeers.set(peerId, peerData);

            // Clean up BitTorrent connections
            await this.bitTorrent.disconnectPeer(peerId);

            res.status(200).json({
                success: true,
                message: 'Peer disconnected successfully'
            });
        } catch (error) {
            logger.error(`Peer disconnection failed: ${error.message}`);
            res.status(error.status || 500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getNetworkInfo() {
        const activePeersCount = Array.from(this.activePeers.values())
            .filter(peer => peer.status === 'active').length;

        return {
            totalPeers: this.activePeers.size,
            activePeers: activePeersCount,
            networkLatency: await this.getAverageNetworkLatency(),
            timestamp: Date.now()
        };
    }

    initializePeerMonitoring() {
        setInterval(() => this.monitorPeers(), 30000); // Every 30 seconds
    }

    async monitorPeers() {
        for (const [peerId, peerData] of this.activePeers) {
            try {
                const isResponsive = await this.networkValidator.pingPeer(peerId);
                
                if (!isResponsive) {
                    peerData.status = 'unresponsive';
                    metrics.peerUnresponsive(peerId);
                }

                peerData.lastSeen = isResponsive ? Date.now() : peerData.lastSeen;
                this.activePeers.set(peerId, peerData);
            } catch (error) {
                logger.error(`Peer monitoring failed for ${peerId}: ${error.message}`);
            }
        }
    }

    async getAverageNetworkLatency() {
        // Implement network latency calculation
        return 0; // Placeholder
    }
}