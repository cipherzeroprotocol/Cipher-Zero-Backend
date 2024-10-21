const jwt = require('jsonwebtoken'); // JWT for token validation
const logger = require('../utils/logger'); // Logger for tracking authentication attempts
const { JWT_SECRET } = require('../config/default.json'); // Secret key for verifying tokens

/**
 * Middleware to authenticate requests using JWT.
 * Verifies the token provided in the request headers.
 * 
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @param {Function} next - The next middleware function to be called
 */
const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    logger.warn('Authentication failed: No token provided');
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    // Verify the provided token using the secret key
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach the decoded user information to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    logger.error(`Invalid or expired token: ${err.message}`);
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = auth;
