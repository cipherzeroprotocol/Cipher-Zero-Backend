const { Connection, PublicKey } = require('@solana/web3.js');
const { 
  LightSystemProgram, 
  createRpc 
} = require('@lightprotocol/stateless.js');
const Redis = require('ioredis');
const logger = require('./utils/logger');
const { getTokenInfo } = require('./services/tokenService');

class TokenRetriever {
  constructor(mongoClient, redisConfig) {
    this.mongoClient = mongoClient;
    this.redis = this.setupRedis(redisConfig);
    this.rpc = null;
    this.connection = null;
  }

  setupRedis(redisConfig) {
    if (!redisConfig || !redisConfig.enabled) {
      return null;
    }

    const redis = redisConfig.isCluster ? 
      new Redis.Cluster([
        {
          host: redisConfig.host,
          port: redisConfig.port,
        }
      ], {
        redisOptions: {
          password: redisConfig.password,
        }
      }) : new Redis(redisConfig);

    redis.on('connect', () => {
      logger.info('Connected to Redis');
    });

    redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    return redis;
  }

  async initialize(config) {
    try {
      // Initialize Solana connection
      this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
      this.rpc = createRpc(config.solana.rpcUrl);

      // Initialize database collections
      this.tokensCollection = this.mongoClient.collection('tokens');
      this.tokenSummaryCollection = this.mongoClient.collection('token_summary');
      this.tokenHoldersCollection = this.mongoClient.collection('token_holders');

      logger.info('Token retriever initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize token retriever:', error);
      throw error;
    }
  }

  async retrieveCompressedToken(mintAddress) {
    try {
      // Check cache first if Redis is enabled
      if (this.redis) {
        const cachedToken = await this.redis.get(`token:${mintAddress}`);
        if (cachedToken) {
          return JSON.parse(cachedToken);
        }
      }

      // Get token account info using ZK compression
      const { compressedAccount } = await this.rpc.getCompressedTokenAccount(
        new PublicKey(mintAddress)
      );

      if (!compressedAccount) {
        throw new Error('Token account not found');
      }

      // Get additional token information
      const tokenInfo = await getTokenInfo(mintAddress, this.connection);

      const token = {
        address: mintAddress,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        totalSupply: tokenInfo.supply.toString(),
        holders: await this.getTokenHolderCount(mintAddress),
        compressedData: compressedAccount,
        lastUpdated: new Date()
      };

      // Save to database
      await this.saveTokenData(token);

      // Cache if Redis enabled
      if (this.redis) {
        await this.redis.set(
          `token:${mintAddress}`, 
          JSON.stringify(token),
          'EX',
          3600 // Cache for 1 hour
        );
      }

      return token;

    } catch (error) {
      logger.error(`Error retrieving token ${mintAddress}:`, error);
      throw error;
    }
  }

  async getTokenHolderCount(mintAddress) {
    try {
      return await this.tokenHoldersCollection.countDocuments({
        tokenMint: mintAddress
      });
    } catch (error) {
      logger.error(`Error getting holder count for ${mintAddress}:`, error);
      return 0;
    }
  }

  async saveTokenData(token) {
    try {
      // Update token info
      await this.tokensCollection.updateOne(
        { address: token.address },
        { $set: token },
        { upsert: true }
      );

      // Update token summary
      await this.tokenSummaryCollection.updateOne(
        { address: token.address },
        {
          $set: {
            name: token.name,
            symbol: token.symbol,
            totalSupply: token.totalSupply,
            holders: token.holders,
            lastUpdated: token.lastUpdated
          }
        },
        { upsert: true }
      );

    } catch (error) {
      logger.error('Error saving token data:', error);
      throw error;
    }
  }

  async retrieveAllTokens() {
    try {
      logger.info('Starting retrieval of all tokens');
      const tokens = await this.tokensCollection.find({}).toArray();

      for (const token of tokens) {
        await this.retrieveCompressedToken(token.address);
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      logger.info('Completed retrieval of all tokens');
    } catch (error) {
      logger.error('Error retrieving all tokens:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      logger.info('Token retriever cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

module.exports = TokenRetriever;

// Example usage:
/*
const config = require('./config');
const mongoClient = require('./mongo-client');

async function main() {
  const tokenRetriever = new TokenRetriever(mongoClient, config.redis);
  await tokenRetriever.initialize(config);

  try {
    // Retrieve single token
    const token = await tokenRetriever.retrieveCompressedToken(
      'TOKEN_MINT_ADDRESS'
    );
    console.log('Retrieved token:', token);

    // Retrieve all tokens
    await tokenRetriever.retrieveAllTokens();

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await tokenRetriever.cleanup();
  }
}

if (require.main === module) {
  main();
}
*/