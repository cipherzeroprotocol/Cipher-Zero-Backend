// api/fiat_api.js

import axios from 'axios';

// Replace these with actual API endpoints and keys
const FIAT_API_BASE_URL = 'https://api.examplefiat.com';// find actual API endpoint
const API_KEY = 'YOUR_API_KEY'; // Replace with your actual API key

// Function to process fiat transactions
export const processFiatTransaction = async (userId, amount, currency) => {
    try {
        const response = await axios.post(`${FIAT_API_BASE_URL}/transactions`, {
            userId,
            amount,
            currency,
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to process fiat transaction: ${error.response?.data?.message || error.message}`);
    }
};

// Function to get fiat conversion rates
export const getFiatConversionRates = async () => {
    try {
        const response = await axios.get(`${FIAT_API_BASE_URL}/conversion-rates`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to get fiat conversion rates: ${error.response?.data?.message || error.message}`);
    }
};
