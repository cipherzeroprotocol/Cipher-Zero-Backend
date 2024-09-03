// src/nodeManagement/nodeMonitor.js

const { MongoClient } = require('mongodb');
const os = require('os');
const { EventEmitter } = require('events');

// MongoDB URI and database name
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'bitThetaSecure';
const NODES_COLLECTION = 'nodes';

class NodeMonitor extends EventEmitter {
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
     * Monitors the health and performance of all nodes.
     * @returns {Promise<void>}
     */
    async monitorNodes() {
        await this.connect();

        // Example metrics
        const metrics = {
            cpuUsage: os.loadavg(),
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };

        // Retrieve node statuses
        const nodes = await this.db.collection(NODES_COLLECTION).find().toArray();

        nodes.forEach(node => {
            // Log node metrics and status
            console.log(`Node ${node._id} - Status: ${node.status}`);
            console.log(`Metrics:`, metrics);
            
            // Emit an event if node status indicates an issue
            if (node.status === 'unhealthy') {
                this.emit('nodeIssue', node);
            }
        });
    }

    /**
     * Sets up event listeners for node issues.
     * @param {Function} listener - The callback function to be executed on node issue.
     */
    onNodeIssue(listener) {
        this.on('nodeIssue', listener);
    }
}

module.exports = { NodeMonitor };
