// src/transactions/transactionAudit.js

const { MongoClient } = require('mongodb');

// MongoDB URI and database name
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'bitThetaSecure';
const TRANSACTIONS_COLLECTION = 'transactions';

/**
 * Audits transactions to ensure accuracy and reconciliation.
 * @param {Object} criteria - Criteria for auditing transactions (e.g., date range, status).
 * @returns {Promise<Array>} - List of audited transactions.
 */
const auditTransactions = async (criteria) => {
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(TRANSACTIONS_COLLECTION);

        const transactions = await collection.find(criteria).toArray();

        // Example reconciliation logic: check for discrepancies
        const discrepancies = transactions.filter(transaction => !transaction.reconciled);

        console.log(`Audited ${transactions.length} transactions, found ${discrepancies.length} discrepancies.`);

        return discrepancies;
    } catch (error) {
        console.error('Error auditing transactions:', error);
        throw error;
    } finally {
        await client.close();
    }
};

/**
 * Reconciles a single transaction.
 * @param {string} transactionId - The ID of the transaction to reconcile.
 * @returns {Promise<void>}
 */
const reconcileTransaction = async (transactionId) => {
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(TRANSACTIONS_COLLECTION);

        const result = await collection.updateOne(
            { _id: transactionId },
            { $set: { reconciled: true } }
        );

        if (result.matchedCount === 0) {
            throw new Error('Transaction not found');
        }

        console.log(`Transaction ${transactionId} reconciled.`);
    } catch (error) {
        console.error('Error reconciling transaction:', error);
        throw error;
    } finally {
        await client.close();
    }
};

module.exports = { auditTransactions, reconcileTransaction };
