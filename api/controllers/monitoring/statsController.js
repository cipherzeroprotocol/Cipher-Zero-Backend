class StatsController {
    constructor(connection) {
        this.connection = connection;
        this.metrics = metrics;
        this.statsCache = redis.getClient();
        
        // Initialize stats collection
        this.initializeStatsCollection();
    }

    async getNetworkStats(req, res) {
        try {
            const { timeframe = '24h' } = req.query;
            
            // Try to get from cache first
            const cachedStats = await this.statsCache.get(`stats:${timeframe}`);
            if (cachedStats) {
                return res.status(200).json(JSON.parse(cachedStats));
            }

            // Calculate stats
            const stats = await this.calculateNetworkStats(timeframe);
            
            // Cache results
            await this.statsCache.setex(
                `stats:${timeframe}`,
                300, // 5 minutes cache
                JSON.stringify(stats)
            );

            res.status(200).json(stats);
        } catch (error) {
            logger.error(`Stats retrieval failed: ${error.message}`);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async calculateNetworkStats(timeframe) {
        const now = Date.now();
        const stats = {
            timestamp: now,
            timeframe,
            networkHealth: await this.getNetworkHealth(),
            proofStats: await this.getProofStats(timeframe),
            peerStats: await this.getPeerStats(timeframe),
            performanceMetrics: await this.getPerformanceMetrics(timeframe)
        };

        return stats;
    }

    async getNetworkHealth() {
        return {
            status: 'healthy', // Implement actual health check
            uptime: process.uptime(),
            lastCheckTimestamp: Date.now()
        };
    }

    async getProofStats(timeframe) {
        return {
            totalProofs: await this.metrics.getTotalProofs(timeframe),
            successRate: await this.metrics.getProofSuccessRate(timeframe),
            averageGenerationTime: await this.metrics.getAverageProofTime(timeframe)
        };
    }

    async getPeerStats(timeframe) {
        return {
            totalPeers: await this.metrics.getTotalPeers(),
            activePeers: await this.metrics.getActivePeers(),
            peerChurnRate: await this.metrics.getPeerChurnRate(timeframe)
        };
    }

    async getPerformanceMetrics(timeframe) {
        return {
            averageLatency: await this.metrics.getAverageLatency(timeframe),
            throughput: await this.metrics.getThroughput(timeframe),
            errorRate: await this.metrics.getErrorRate(timeframe)
        };
    }

    initializeStatsCollection() {
        // Collect stats every minute
        setInterval(() => this.collectStats(), 60000);
    }

    async collectStats() {
        try {
            const stats = await this.calculateNetworkStats('1m');
            await this.metrics.recordStats(stats);
        } catch (error) {
            logger.error(`Stats collection failed: ${error.message}`);
        }
    }
}

module.exports = {
    ProofController,
    PeerController,
    StatsController
};