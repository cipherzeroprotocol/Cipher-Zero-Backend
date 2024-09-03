// src/utils/errorHandling.js

const fs = require('fs');
const path = require('path');

/**
 * Logs error details to a file.
 * @param {Error} error - The error object to log.
 */
const logErrorToFile = (error) => {
    const logFilePath = path.join(__dirname, 'error.log');
    const errorDetails = `${new Date().toISOString()} - ${error.message}\n${error.stack}\n\n`;
    fs.appendFileSync(logFilePath, errorDetails);
};

/**
 * Handles errors by logging them and providing a standardized response.
 * @param {Error} error - The error object to handle.
 * @param {Object} [res] - Optional response object to send an error message.
 */
const handleError = (error, res = null) => {
    logErrorToFile(error);
    if (res) {
        res.status(500).json({ message: 'An internal server error occurred.' });
    } else {
        console.error('Unhandled Error:', error.message);
    }
};

module.exports = { handleError };
