const TokenSummary = require('./models/TokenSummary');
const logger = require('../utils/logger');

class TokenSummaryDao {
    constructor(basePath, mongoClient) {
        this.basePath = basePath;
        this.mongoClient = mongoClient;
    }

    async updateTokenSummaryAsync(summary) {
        try {
            return await TokenSummary.findOneAndUpdate(
                { address: summary.address },
                summary,
                { upsert: true, new: true }
            );
        } catch (error) {
            logger.error('Error updating token summary:', error);
            throw error;
        }
    }

    async getTokenSummaryAsync(address) {
        try {
            return await TokenSummary.findOne({ address });
        } catch (error) {
            logger.error('Error getting token summary:', error);
            throw error;
        }
    }
}

module.exports = TokenSummaryDao;
