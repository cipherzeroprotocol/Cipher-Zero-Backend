// index.js
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const logger = require('./utils/logger');

// Import routes
const fileRoutes = require('./routes/fileRoutes');
const messageRoutes = require('./routes/messageRoutes');
const nodeRoutes = require('./routes/nodeRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const zkTorrentRoutes = require('./routes/zkTorrentRoutes');
const tokenRoutes = require('./routes/tokenRoutes');

// Import middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');

// Import services
const { ZKTorrentService } = require('./services/zkTorrentService');
const { TokenService } = require('./services/tokenService');
const { initializeSolanaConnection } = require('./utils/solanaUtils');
const { initializeNeonEVM } = require('./utils/neonEVMUtils');

function createApp(config, services) {
  const app = express();

  // Basic security middleware
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  app.use(compression());
  app.use(cors());

  // Rate limiting
  app.use(rateLimiter);

  // Body parsing middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check endpoint
  app.get('/ping', (req, res) => {
    res.status(200).send('OK');
  });

  // Attach services to request object
  app.use((req, res, next) => {
    req.services = services;
    req.config = config;
    next();
  });

  // API Routes with versioning
  const apiRouter = express.Router();

  apiRouter.use('/files', authMiddleware, fileRoutes);
  apiRouter.use('/messages', authMiddleware, messageRoutes);
  apiRouter.use('/nodes', authMiddleware, nodeRoutes);
  apiRouter.use('/transactions', authMiddleware, transactionRoutes);
  apiRouter.use('/zk-torrent', authMiddleware, zkTorrentRoutes);
  apiRouter.use('/tokens', authMiddleware, tokenRoutes);

  app.use('/api/v1', apiRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}

async function initializeServices(config) {
  try {
    // Initialize Solana connection
    const solanaConnection = await initializeSolanaConnection(config.solana);
    logger.info('Solana connection established');

    // Initialize Neon EVM connection
    const neonEVM = await initializeNeonEVM(config.neonEVM);
    logger.info('Neon EVM connection established');

    // Initialize ZK Torrent Service
    const zkTorrentService = new ZKTorrentService(solanaConnection, neonEVM);
    await zkTorrentService.initialize(config.zkTorrent);
    logger.info('ZK Torrent Service initialized');

    // Initialize Token Service
    const tokenService = new TokenService(solanaConnection, config.token);
    await tokenService.initialize();
    logger.info('Token Service initialized');

    return {
      solanaConnection,
      neonEVM,
      zkTorrentService,
      tokenService
    };
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

async function startServer(config) {
  try {
    // Initialize all services
    const services = await initializeServices(config);

    // Create Express app
    const app = createApp(config, services);

    // Start server
    return new Promise((resolve, reject) => {
      const server = app.listen(config.server.port, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        logger.info(`Server started on port ${config.server.port}`);
        logger.info(`Environment: ${process.env.NODE_ENV}`);
        resolve(server);
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('SIGTERM signal received: closing HTTP server');
        
        try {
          // Cleanup services
          await services.zkTorrentService.cleanup();
          await services.tokenService.cleanup();
          
          server.close(() => {
            logger.info('HTTP server closed');
            process.exit(0);
          });
        } catch (error) {
          logger.error('Error during cleanup:', error);
          process.exit(1);
        }
      });

      // Handle uncaught errors
      process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception:', error);
        process.exit(1);
      });

      process.on('unhandledRejection', (error) => {
        logger.error('Unhandled rejection:', error);
        process.exit(1);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    throw error;
  }
}

module.exports = { startServer };