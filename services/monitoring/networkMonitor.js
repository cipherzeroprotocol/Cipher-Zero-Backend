const { EventEmitter } = require('events');
const { PeerStatsDao } = require('../../mongo-db/dao');
const logger = require('../../utils/logger');
const events = require('../../api/websocket/events/eventEmitter');
const EventTypes = require('../../api/websocket/events/eventTypes');

class NetworkMonitor extends EventEmitter {
   constructor(torrentManager, peerStatsDao) {
       super();
       this.torrentManager = torrentManager;
       this.peerStatsDao = peerStatsDao;
       this.healthStats = new Map();
       this.monitoringInterval = null;
       this.MONITOR_INTERVAL = 30000; // 30 seconds
       this.setupEventHandlers();
   }

   /**
    * Start network monitoring
    */
   start() {
       this.monitoringInterval = setInterval(
           () => this.checkNetworkHealth(),
           this.MONITOR_INTERVAL
       );
       logger.info('Network monitoring started');
   }

   /**
    * Stop network monitoring
    */
   stop() {
       if (this.monitoringInterval) {
           clearInterval(this.monitoringInterval);
           this.monitoringInterval = null;
       }
       logger.info('Network monitoring stopped');
   }

   /**
    * Check network health
    */
   async checkNetworkHealth() {
       try {
           const stats = await this.collectNetworkStats();
           this.healthStats.set(Date.now(), stats);

           // Keep last 24 hours of stats
           const cutoff = Date.now() - (24 * 60 * 60 * 1000);
           for (const [timestamp] of this.healthStats) {
               if (timestamp < cutoff) {
                   this.healthStats.delete(timestamp);
               }
           }

           // Analyze health status
           const healthStatus = await this.analyzeHealthStatus(stats);

           // Emit health update
           events.emit(EventTypes.SYSTEM.NETWORK_HEALTH, {
               stats,
               status: healthStatus
           });

           // Handle critical issues
           if (healthStatus.critical) {
               await this.handleCriticalIssues(healthStatus.issues);
           }

           return { stats, status: healthStatus };

       } catch (error) {
           logger.error('Network health check failed:', error);
           throw error;
       }
   }

   /**
    * Collect network statistics
    */
   async collectNetworkStats() {
       const stats = {
           timestamp: Date.now(),
           peers: {
               total: 0,
               active: 0,
               seeders: 0,
               leechers: 0
           },
           bandwidth: {
               uploadSpeed: 0,
               downloadSpeed: 0,
               totalTransferred: 0
           },
           torrents: {
               active: 0,
               completed: 0,
               total: 0
           },
           privacy: {
               mixingSessions: 0,
               averageAnonymityScore: 0
           },
           latency: {
               average: 0,
               min: 0,
               max: 0
           }
       };

       // Collect peer stats
       const peers = await this.torrentManager.getPeers();
       stats.peers.total = peers.length;
       stats.peers.active = peers.filter(p => p.isActive()).length;
       stats.peers.seeders = peers.filter(p => p.isSeeder()).length;
       stats.peers.leechers = peers.filter(p => p.isLeecher()).length;

       // Calculate bandwidth stats
       stats.bandwidth = await this.calculateBandwidthStats();

       // Get torrent stats
       const torrents = await this.torrentManager.getTorrents();
       stats.torrents.total = torrents.length;
       stats.torrents.active = torrents.filter(t => t.isActive()).length;
       stats.torrents.completed = torrents.filter(t => t.isComplete()).length;

       // Get privacy metrics
       stats.privacy = await this.calculatePrivacyMetrics();

       // Calculate latency stats
       stats.latency = await this.calculateLatencyStats(peers);

       return stats;
   }

   /**
    * Analyze network health status
    */
   async analyzeHealthStatus(stats) {
       const status = {
           overall: 'healthy',
           critical: false,
           issues: []
       };

       // Check peer count
       if (stats.peers.total < 10) {
           status.issues.push({
               type: 'peers',
               severity: 'warning',
               message: 'Low peer count'
           });
       }

       // Check bandwidth
       if (stats.bandwidth.uploadSpeed === 0) {
           status.issues.push({
               type: 'bandwidth',
               severity: 'critical',
               message: 'No upload bandwidth'
           });
           status.critical = true;
       }

       // Check latency
       if (stats.latency.average > 1000) {
           status.issues.push({
               type: 'latency',
               severity: 'warning',
               message: 'High network latency'
           });
       }

       // Check privacy metrics
       if (stats.privacy.averageAnonymityScore < 50) {
           status.issues.push({
               type: 'privacy',
               severity: 'warning',
               message: 'Low anonymity score'
           });
       }

       // Set overall status
       if (status.critical) {
           status.overall = 'critical';
       } else if (status.issues.length > 0) {
           status.overall = 'degraded';
       }

       return status;
   }

   /**
    * Handle critical network issues
    */
   async handleCriticalIssues(issues) {
       for (const issue of issues) {
           logger.error(`Critical network issue: ${issue.message}`);
           
           switch (issue.type) {
               case 'bandwidth':
                   await this.handleBandwidthIssue();
                   break;
               case 'peers':
                   await this.handlePeerIssue();
                   break;
               case 'privacy':
                   await this.handlePrivacyIssue();
                   break;
               default:
                   logger.warn(`Unknown issue type: ${issue.type}`);
           }
       }
   }

   /**
    * Setup event handlers
    */
   setupEventHandlers() {
       this.torrentManager.on('peer:connected', this.onPeerConnected.bind(this));
       this.torrentManager.on('peer:disconnected', this.onPeerDisconnected.bind(this));
       this.torrentManager.on('torrent:added', this.onTorrentAdded.bind(this));
       this.torrentManager.on('torrent:removed', this.onTorrentRemoved.bind(this));
   }
}
