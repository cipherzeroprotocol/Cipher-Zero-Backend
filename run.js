// run.js
const { Connection } = require('@solana/web3.js');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { ZKTorrentService } = require('./services/zkTorrentService');
const { TorrentPrivacyTools } = require('./privacy/torrent_privacy_tools');
const { startServer } = require('./index');
const { logger } = require('./utils/logger');
const { loadConfig } = require('./utils/config');
const { 
  fileRoutes,
  messageRoutes, 
  nodeRoutes,
  zkTorrentRoutes
} = require('./routes');

class CipherZeroServer {
  constructor() {
    this.app = express();
    this.setupMiddleware();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(compression());
    this.app.use(express.json());
  }

  setupHealthChecks() {
    this.app.get('/ping', (req, res) => {
      logger.info(`Healthcheck ping from ${req.ip}`);
      res.status(200).send('OK');
    });
  }

  setupRoutes() {
    this.app.use('/api/files', fileRoutes);
    this.app.use('/api/messages', messageRoutes);
    this.app.use('/api/nodes', nodeRoutes);
    this.app.use('/api/zk-torrent', zkTorrentRoutes);
  }

  async initializeSolanaConnection() {
    const config = loadConfig();
    this.solanaConnection = new Connection(
      config.solana.rpcUrl,
      { commitment: 'confirmed' }
    );
    await this.solanaConnection.getVersion();
    logger.info('Solana connection established');
  }

  async initializeServices() {
    try {
      // Initialize ZK Torrent Service
      this.zkTorrentService = new ZKTorrentService(this.solanaConnection);
      await this.zkTorrentService.initialize();

      // Initialize Privacy Tools
      this.torrentPrivacyTools = new TorrentPrivacyTools();
      await this.torrentPrivacyTools.initialize();

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Service initialization failed:', error);
      throw error;
    }
  }

  async start() {
    try {
      const config = loadConfig();
      
            await this.initializeSolanaConnection();
            await this.initializeServices();
            this.setupHealthChecks();
            this.setupRoutes();
            startServer(this.app);
          } catch (error) {
            logger.error('Server failed to start:', error);
            process.exit(1);
          }
        }
      }
