const jwt = require('jsonwebtoken'); // JWT library for creating and verifying tokens
const config = require('../config/default.json'); // Load configuration for secret key and token expiration

class TokenManager {
    constructor() {
        this.secretKey = config.jwtSecret; // Secret key for signing tokens
        this.tokenExpiration = config.tokenExpiration; // Token expiration time (in seconds)
    }

    /**
     * Generates a new JWT token for a user.
     * 
     * @param {Object} user - The user object containing user details.
     * @returns {String} - The generated JWT token.
     */
    generateToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role, // Add roles for authorization if needed
        };

        return jwt.sign(payload, this.secretKey, { expiresIn: this.tokenExpiration });
    }

    /**
     * Validates a JWT token.
     * 
     * @param {String} token - The JWT token to validate.
     * @returns {Object} - The decoded payload if valid, otherwise throws an error.
     */
    validateToken(token) {
        try {
            return jwt.verify(token, this.secretKey); // Verify the token and return decoded payload
        } catch (error) {
            throw new Error('Invalid token'); // Handle invalid token error
        }
    }

    /**
     * Refreshes a JWT token.
     * 
     * @param {String} oldToken - The old JWT token to refresh.
     * @returns {String} - The newly generated JWT token.
     */
    refreshToken(oldToken) {
        const decoded = this.validateToken(oldToken); // Validate the old token
        // Generate a new token with the same user information
        return this.generateToken({ id: decoded.id, email: decoded.email, role: decoded.role });
    }
}

module.exports = new TokenManager(); // Export a singleton instance of TokenManager
