// fiat-on-ramps/fiat_on_ramps.js

import express from 'express';
import bodyParser from 'body-parser';
import { processFiatTransaction, getFiatConversionRates } from '../api/fiat_api'; // Adjust import path as needed

const router = express.Router();

// Middleware
router.use(bodyParser.json());

// Route to process fiat transactions
router.post('/api/fiat/transaction', async (req, res) => {
    try {
        const { userId, amount, currency } = req.body;
        if (!userId || !amount || !currency) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const result = await processFiatTransaction(userId, amount, currency);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to get fiat conversion rates
router.get('/api/fiat/conversion-rates', async (req, res) => {
    try {
        const rates = await getFiatConversionRates();
        res.status(200).json(rates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
