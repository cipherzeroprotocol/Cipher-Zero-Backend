// index.js
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fileRoutes = require('./routes/fileRoutes');
const zkTorrentRoutes = require('./routes/zkTorrentRoutes');
const { setupMiddleware } = require('./middleware/setupMiddleware');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

function createApp(services) {
  const app = express();

  // Basic security middleware
  app.use(helmet());
  app.use(compression());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  });
  app.use(limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Setup custom middleware
  setupMiddleware(app);

  // Attach services to the request object
  app.use((req, res, next) => {
    req.services = services;
    next();
  });

  // Routes
  app.use('/api/files', fileRoutes);
  app.use('/api/zk-torrent', zkTorrentRoutes);

  // Error handling
  app.use(errorHandler);

  return app;
}

async function startServer(port, services) {
  const app = createApp(services);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, (err) => {
      if (err) {
        reject(err);
      } else {
        logger.info(`Server started on port ${port}`);
        resolve(server);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  });
}

module.exports = { startServer };