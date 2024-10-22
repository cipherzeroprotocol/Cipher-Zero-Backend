// mongo-db/token-dao.js
const Token = require('./models/Token');
const logger = require('../utils/logger');

class TokenDao {
    constructor(basePath, mongoClient) {
        this.basePath = basePath;
        this.mongoClient = mongoClient;
    }

    async getAllTokensAsync() {
        try {
            return await Token.find({});
        } catch (error) {
            logger.error('Error getting all tokens:', error);
            throw error;
        }
    }

    async getTokenByAddressAsync(address) {
        try {
            return await Token.findOne({ address });
        } catch (error) {
            logger.error('Error getting token:', error);
            throw error;
        }
    }

    async updateTokenAsync(token) {
        try {
            return await Token.findOneAndUpdate(
                { address: token.address },
                token,
                { upsert: true, new: true }
            );
        } catch (error) {
            logger.error('Error updating token:', error);
            throw error;
        }
    }
}

module.exports = TokenDao;