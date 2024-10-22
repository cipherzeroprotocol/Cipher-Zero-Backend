const mongoose = require('mongoose');
const logger = require('../utils/logger');

class MongoClient {
    constructor() {
        this.connection = null;
    }

    init(basePath, address, port, dbName) {
        this.basePath = basePath;
        this.address = address;
        this.port = port;
        this.dbName = dbName;
    }

    async connect(uri) {
        try {
            this.connection = await mongoose.connect(uri, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            logger.info('MongoDB connected successfully');
            return this.connection;
        } catch (error) {
            logger.error('MongoDB connection failed:', error);
            throw error;
        }
    }

    getCollection(collectionName) {
        return this.connection.collection(collectionName);
    }

    async close() {
        if (this.connection) {
            await mongoose.disconnect();
        }
    }
}

module.exports = new MongoClient();