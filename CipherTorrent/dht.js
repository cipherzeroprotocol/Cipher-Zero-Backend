// CipherTorrent/dht.js
const EventEmitter = require('events');
const { DHT } = require('bittorrent-dht');
const crypto = require('crypto');
const logger = require('../utils/logger');

class DHTManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.bootstrapNodes = [
      { address: 'router.bittorrent.com', port: 6881 },
      { address: 'router.utorrent.com', port: 6881 },
      { address: 'dht.transmissionbt.com', port: 6881 }
    ];

    this.config = {
      nodeId: crypto.randomBytes(20),
      timeout: 5000,
      maxConnections: 1000,
      ...config
    };

    this.hashes = new Map();
    this.node = null;
    this.isInitialized = false;
  }

  init(callback) {
    if (this.isInitialized) {
      logger.warn('DHT already initialized');
      if (callback) callback();
      return;
    }

    try {
      this.node = new DHT({
        nodeId: this.config.nodeId,
        verify: crypto.randomBytes(32)
      });

      this.node.on('ready', () => {
        logger.info('DHT node is ready');
        this.emit('ready');
      });

      this.node.on('peer', this._handleNewPeer.bind(this));
      this.node.on('error', this._handleError.bind(this));
      this.node.on('warning', this._handleWarning.bind(this));

      // Start listening
      const port = this.config.port || 20000 + Math.floor(Math.random() * 20000);
      this.node.listen(port, (err) => {
        if (err) {
          logger.error(`Failed to start DHT on port ${port}:`, err);
          if (callback) callback(err);
          return;
        }
        
        logger.info(`DHT listening on port ${port}`);
        this._connectToBootstrapNodes();
        this.isInitialized = true;
        if (callback) callback();
      });

    } catch (error) {
      logger.error('Failed to initialize DHT:', error);
      if (callback) callback(error);
    }
  }

  _connectToBootstrapNodes() {
    this.bootstrapNodes.forEach(bootstrapNode => {
      try {
        logger.debug(`Connecting to bootstrap node: ${bootstrapNode.address}:${bootstrapNode.port}`);
        this.node.addNode({
          host: bootstrapNode.address,
          port: bootstrapNode.port
        });
      } catch (error) {
        logger.warn(`Failed to connect to bootstrap node ${bootstrapNode.address}:`, error);
      }
    });

    logger.info('Completed bootstrap node connection attempts');
  }

  advertise(infohash, callback) {
    if (!this.isInitialized) {
      const error = new Error('DHT not initialized');
      if (callback) callback(error);
      return;
    }

    try {
      const infohashBuffer = Buffer.isBuffer(infohash) 
        ? infohash 
        : Buffer.from(infohash, 'hex');

      this.hashes.set(infohashBuffer.toString('hex'), callback);
      
      logger.debug(`Advertising infohash: ${infohashBuffer.toString('hex')}`);
      this.node.announce(infohashBuffer, this.node.address().port, (err) => {
        if (err) {
          logger.error('Announce failed:', err);
          if (callback) callback(err);
          return;
        }
        if (callback) callback(null);
      });

    } catch (error) {
      logger.error('Failed to advertise infohash:', error);
      if (callback) callback(error);
    }
  }

  _handleNewPeer(peer, infohash, from) {
    try {
      const hexInfohash = infohash.toString('hex');
      logger.debug(`New peer connection over DHT for infohash: ${hexInfohash}`);

      if (!this._isValidPeer(peer)) {
        logger.debug(`Invalid peer ${peer.host}:${peer.port}, ignoring`);
        return;
      }

      const callback = this.hashes.get(hexInfohash);
      if (callback) {
        callback(null, peer.host, peer.port);
      }

      this.emit('peer', { peer, infohash: hexInfohash, from });
    } catch (error) {
      logger.error('Error handling new peer:', error);
    }
  }

  _isValidPeer(peer) {
    return (
      peer &&
      peer.port > 0 &&
      peer.port < 65536 &&
      peer.host &&
      peer.host.length > 0
    );
  }

  _handleError(error) {
    logger.error('DHT error:', error);
    this.emit('error', error);
  }

  _handleWarning(warning) {
    logger.warn('DHT warning:', warning);
    this.emit('warning', warning);
  }

  destroy(callback) {
    if (!this.node) {
      if (callback) callback();
      return;
    }

    this.node.destroy(() => {
      logger.info('DHT node destroyed');
      this.isInitialized = false;
      this.hashes.clear();
      if (callback) callback();
    });
  }

  getStats() {
    if (!this.node) return null;
    
    return {
      nodes: this.node.nodes.length,
      activeAdvertisements: this.hashes.size,
      port: this.node.address().port,
      isInitialized: this.isInitialized
    };
  }
}

// Export singleton instance
module.exports = new DHTManager();