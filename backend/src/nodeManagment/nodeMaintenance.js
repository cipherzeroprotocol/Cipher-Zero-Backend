// src/nodeManagement/nodeMaintenance.js

const { MongoClient } = require('mongodb');

// MongoDB URI and database name
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'bitThetaSecure';
const NODES_COLLECTION = 'nodes';

/**
 * Applies updates and performs maintenance tasks on nodes.
 * @param {string} nodeId - The ID of the node to maintain.
 * @param {Object} updates - The updates to apply.
 * @returns {Promise<void>}
 */
const performMaintenance = async (nodeId, updates) => {
    const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(NODES_COLLECTION);

        // Apply updates
        const result = await collection.updateOne(
            { _id: nodeId },
            { $set: updates }
        );

        if (result.matchedCount === 0) {
            throw new Error('Node not found');
        }

        console.log(`Node ${nodeId} updated with`, updates);
    } catch (error) {
        console.error('Error performing maintenance:', error);
        throw error;
    } finally {
        await client.close();
    }
};

/**
 * Schedules maintenance tasks for nodes.
 * @param {Array<string>} nodeIds - The IDs of the nodes to maintain.
 * @param {Object} updates - The updates to apply.
 * @returns {Promise<void>}
 */
const scheduleMaintenance = async (nodeIds, updates) => {
    for (const nodeId of nodeIds) {
        await performMaintenance(nodeId, updates);
    }
};

module.exports = { performMaintenance, scheduleMaintenance };
