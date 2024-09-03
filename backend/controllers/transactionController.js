const transactionService = require('../services/transactionService');

const submitTransaction = async (req, res) => {
    try {
        const transaction = req.body;
        const result = await transactionService.submitTransaction(transaction);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { submitTransaction };
