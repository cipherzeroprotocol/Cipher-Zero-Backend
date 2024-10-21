const rateLimit = require('express-rate-limit'); // Import the express-rate-limit package
const logger = require('../utils/logger'); // Logger for tracking rate limit events

// Create a rate limiter that allows a maximum of 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`); // Log when rate limit is exceeded
    res.status(429).json({ error: 'Too many requests, please try again later.' }); // Respond with a 429 status code
  }
});

module.exports = limiter; // Export the rate limiter middleware
