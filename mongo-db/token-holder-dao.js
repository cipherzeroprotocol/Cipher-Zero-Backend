// mongo-db/token-holder-dao.js
const TokenHolder = require('./models/TokenHolder');
const logger = require('../utils/logger');

class TokenHolderDao {
    constructor(basePath, mongoClient) {
        this.basePath = basePath;
        this.mongoClient = mongoClient;
    }

    async getTokenHoldersCountAsync(tokenAddress) {
        try {
            return await TokenHolder.countDocuments({ tokenAddress });
        } catch (error) {
            logger.error('Error getting token holders count:', error);
            throw error;
        }
    }

    async updateTokenHolderAsync(tokenAddress, holderAddress, balance) {
        try {
            return await TokenHolder.findOneAndUpdate(
                { tokenAddress, holderAddress },
                { 
                    tokenAddress,
                    holderAddress,
                    balance,
                    lastUpdated: new Date()
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            logger.error('Error updating token holder:', error);
            throw error;
        }
    }
}

module.exports = TokenHolderDao;