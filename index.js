// index.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const logger = require('./utils/logger');

// Import routes
const fileRoutes = require('./api/routes/fileRoutes');
const messageRoutes = require('./api/routes/messageRoutes');
const nodeRoutes = require('./api/routes/nodeRoutes');
const transactionRoutes = require('./api/routes/transactionRoutes');
const zkTorrentRoutes = require('./api/routes/zkTorrentRoutes');
const tokenRoutes = require('./api/routes/tokenRoutes');

// Import middleware
const authMiddleware = require('./api/middleware/auth');
const errorHandler = require('./api/middleware/errorHandler');
const rateLimiter = require('./api/middleware/rateLimiter');

// Import services
const { ZKTorrentService } = require('./services/zkTorrentService');
const { TokenService } = require('./services/tokenService');
const { initializeSolanaConnection } = require('./utils/solanaUtils');
const { initializeNeonEVM } = require('./utils/neonEVMUtils');

async function initializeServices(config) {
  try {
    // Initialize MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    logger.info('MongoDB connection established');

    // Initialize Solana connection
    const solanaConnection = await initializeSolanaConnection({
      rpcUrl: process.env.SOLANA_RPC_URL
    });
    logger.info('Solana connection established');

    // Initialize Neon EVM connection
    const neonEVM = await initializeNeonEVM({
      rpcUrl: process.env.NEON_EVM_RPC_URL
    });
    logger.info('Neon EVM connection established');

    // Initialize services
    const zkTorrentService = new ZKTorrentService(solanaConnection, neonEVM);
    const tokenService = new TokenService(solanaConnection);

    await Promise.all([
      zkTorrentService.initialize(),
      tokenService.initialize()
    ]);

    logger.info('All services initialized successfully');

    return {
      solanaConnection,
      neonEVM,
      zkTorrentService,
      tokenService
    };
  } catch (error) {
    logger.error('Service initialization failed:', error);
    throw error;
  }
}

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    logger.info('New WebSocket connection established');

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        logger.info('Received message:', data);
        
        switch (data.type) {
          case 'FILE_UPLOAD':
            await handleFileUpload(ws, data);
            break;
          case 'MESSAGE':
            await handleMessage(ws, data);
            break;
          default:
            logger.warn('Unknown message type:', data.type);
        }
      } catch (error) {
        logger.error('WebSocket message handling error:', error);
        ws.send(JSON.stringify({ error: 'Message processing failed' }));
      }
    });
  });

  // Heartbeat to detect stale connections
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  return wss;
}

async function startServer() {
  try {
    const app = express();
    const port = process.env.PORT || 3000;

    // Basic security middleware
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }));
    app.use(compression());
    app.use(cors());
    app.use(rateLimiter);

    // Body parsing middleware
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Initialize services
    const services = await initializeServices({
      solana: { rpcUrl: process.env.SOLANA_RPC_URL },
      neonEVM: { rpcUrl: process.env.NEON_EVM_RPC_URL }
    });

    // Attach services to request object
    app.use((req, res, next) => {
      req.services = services;
      next();
    });

    // API Routes
    const apiRouter = express.Router();
    apiRouter.use('/files', authMiddleware, fileRoutes);
    apiRouter.use('/messages', authMiddleware, messageRoutes);
    apiRouter.use('/nodes', authMiddleware, nodeRoutes);
    apiRouter.use('/transactions', authMiddleware, transactionRoutes);
    apiRouter.use('/zk-torrent', authMiddleware, zkTorrentRoutes);
    apiRouter.use('/tokens', authMiddleware, tokenRoutes);

    app.use('/api/v1', apiRouter);

    // Health check endpoint
    app.get('/ping', (req, res) => res.status(200).send('OK'));

    // Error handling
    app.use(errorHandler);

    // Start server
    const server = app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });

    // Setup WebSocket
    const wss = setupWebSocket(server);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      
      try {
        await services.zkTorrentService.cleanup();
        await services.tokenService.cleanup();
        
        server.close(() => {
          mongoose.connection.close(false, () => {
            logger.info('Server shutdown complete');
            process.exit(0);
          });
        });
      } catch (error) {
        logger.error('Error during cleanup:', error);
        process.exit(1);
      }
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    throw error;
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Server startup failed:', error);
    process.exit(1);
  });
}

module.exports = { startServer };