const transactionService = require('../services/transactionService'); // Import transaction service
const logger = require('../utils/logger'); // Import logger for better error tracking
const { validateTransaction } = require('../middleware/inputValidation'); // Transaction input validation middleware/helper

/**
 * Submit a transaction to the system for processing
 * @param {Object} req - The request object, expects body to contain transaction data
 * @param {Object} res - The response object for sending success or error
 */
const submitTransaction = async (req, res) => {
    const transaction = req.body;

    // Validate the transaction data before proceeding (preventing malformed or malicious transactions)
    const { isValid, errors } = validateTransaction(transaction);
    if (!isValid) {
        return res.status(400).json({ error: 'Invalid transaction data', details: errors });
    }

    try {
        // Submit the validated transaction to the transaction service
        const result = await transactionService.submitTransaction(transaction);

        // Handle cases where the service cannot process the transaction properly
        if (!result) {
            return res.status(400).json({ error: 'Transaction submission failed' });
        }

        // Return a successful response with transaction details
        res.status(200).json(result);
    } catch (error) {
        // Log the error details to track issues more effectively
        logger.error(`Error submitting transaction: ${error.message}`, { transaction });

        // Return an error response with a detailed message
        if (error instanceof SomeSpecificTransactionError) {
            return res.status(502).json({ error: 'Transaction service unavailable' });
        }

        // Generic internal server error for unexpected issues
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { submitTransaction };
