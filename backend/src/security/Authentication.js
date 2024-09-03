// src/security/authenticationService.js

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User'); // Hypothetical user model

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret';
const JWT_EXPIRES_IN = '1h'; // Token expiration time

/**
 * Hashes a password.
 * @param {string} password - The password to hash.
 * @returns {Promise<string>} - The hashed password.
 */
const hashPassword = async (password) => {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
};

/**
 * Verifies a password against a hashed password.
 * @param {string} password - The password to verify.
 * @param {string} hashedPassword - The hashed password.
 * @returns {Promise<boolean>} - Whether the password is valid.
 */
const verifyPassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

/**
 * Generates a JWT token.
 * @param {Object} user - The user object.
 * @returns {string} - The generated JWT token.
 */
const generateToken = (user) => {
    return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verifies a JWT token.
 * @param {string} token - The JWT token to verify.
 * @returns {Promise<Object>} - The decoded token.
 */
const verifyToken = async (token) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, JWT_SECRET, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded);
        });
    });
};

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken };
