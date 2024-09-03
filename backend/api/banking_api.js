// api/banking_api.js

import axios from 'axios';

// Replace these with actual API endpoints and keys
const BANK_API_BASE_URL = 'https://api.albaraka.com';
const BANK_API_KEY = 'YOUR_BANK_API_KEY'; // Replace with your actual API key

// Function to initiate bank transfers
export const initiateBankTransfer = async (fromAccount, toAccount, amount) => {
    try {
        const response = await axios.post(`${BANK_API_BASE_URL}/transfers`, {
            fromAccount,
            toAccount,
            amount,
        }, {
            headers: {
                'Authorization': `Bearer ${BANK_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to initiate bank transfer: ${error.response?.data?.message || error.message}`);
    }
};

// Function to get bank account details
export const getBankAccountDetails = async (accountId) => {
    try {
        const response = await axios.get(`${BANK_API_BASE_URL}/accounts/${accountId}`, {
            headers: {
                'Authorization': `Bearer ${BANK_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to get bank account details: ${error.response?.data?.message || error.message}`);
    }
};
