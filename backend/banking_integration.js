// banking-integration/banking_integration.js

import express from 'express';
import bodyParser from 'body-parser';
import { initiateBankTransfer, getBankAccountDetails } from '../api/banking_api'; // Adjust import path as needed

const router = express.Router();

// Middleware
router.use(bodyParser.json());

// Route to initiate bank transfers
router.post('/api/banking/transfer', async (req, res) => {
    try {
        const { fromAccount, toAccount, amount } = req.body;
        if (!fromAccount || !toAccount || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const result = await initiateBankTransfer(fromAccount, toAccount, amount);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to get bank account details
router.get('/api/banking/account/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        const accountDetails = await getBankAccountDetails(accountId);
        res.status(200).json(accountDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
