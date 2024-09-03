// src/dataProcessing/dataAnalytics.js

const { MongoClient } = require('mongodb');

// MongoDB URI and database name
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'bitThetaSecure';

/**
 * Connects to MongoDB.
 * @returns {Promise<MongoClient>} - MongoDB client instance.
 */
const connectToDB = async () => {
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    return client.db(DB_NAME);
};

/**
 * Generates a report based on the data in the database.
 * @param {string} collectionName - The name of the MongoDB collection.
 * @returns {Promise<Object>} - The generated report.
 */
const generateReport = async (collectionName) => {
    const db = await connectToDB();
    const collection = db.collection(collectionName);

    // Example: Generate a count of documents in the collection
    const count = await collection.countDocuments();
    return { collection: collectionName, documentCount: count };
};

/**
 * Provides advanced analytics based on specified queries.
 * @param {string} collectionName - The name of the MongoDB collection.
 * @param {Object} query - The query to run.
 * @returns {Promise<Array>} - The results of the query.
 */
const performAnalytics = async (collectionName, query) => {
    const db = await connectToDB();
    const collection = db.collection(collectionName);
    return collection.find(query).toArray();
};

module.exports = { generateReport, performAnalytics };
