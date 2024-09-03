// src/transactions/transactionMonitor.js

const { MongoClient } = require('mongodb');
const { EventEmitter } = require('events');

// MongoDB URI and database name
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'bitThetaSecure';
const TRANSACTIONS_COLLECTION = 'transactions';

class TransactionMonitor extends EventEmitter {
    constructor() {
        super();
        this.dbClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    }

    /**
     * Connects to the MongoDB database.
     */
    async connect() {
        if (!this.dbClient.isConnected()) {
            await this.dbClient.connect();
        }
        this.db = this.dbClient.db(DB_NAME);
    }

    /**
     * Monitors the status of a transaction.
     * @param {string} transactionId - The ID of the transaction to monitor.
     * @returns {Promise<Object>} - The status of the transaction.
     */
    async monitorTransaction(transactionId) {
        await this.connect();
        const transaction = await this.db.collection(TRANSACTIONS_COLLECTION).findOne({ _id: transactionId });

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        // Emit an event if transaction status changes
        this.emit('statusChange', transaction);

        return transaction;
    }

    /**
     * Sets up event listeners for transaction status changes.
     * @param {Function} listener - The callback function to be executed on status change.
     */
    onStatusChange(listener) {
        this.on('statusChange', listener);
    }
}

module.exports = { TransactionMonitor };
