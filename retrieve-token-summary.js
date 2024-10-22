const bluebird = require("bluebird");
const fs = require('fs');
const { Connection, PublicKey } = require('@solana/web3.js');
const { createRpc } = require('@lightprotocol/stateless.js');
const Logger = require('./crawler/helper/logger.js');
const mongoClient = require('../mongo-db/mongo-client.js');

// Import DAOs
const transactionDaoLib = require('../mongo-db/transaction-dao.js');
const accountTxDaoLib = require('../mongo-db/account-tx-dao.js');
const smartContractDaoLib = require('../mongo-db/smart-contract-dao.js');
const tokenDaoLib = require('../mongo-db/token-dao.js');
const tokenSummaryDaoLib = require('../mongo-db/token-summary-dao.js');
const tokenHolderDaoLib = require('../mongo-db/token-holder-dao.js');

let config = null;
const configFileName = 'config.cfg';

// Initialize DAOs
let transactionDao, accountTxDao, smartContractDao, tokenDao, tokenSummaryDao, tokenHolderDao;
let connection, rpc;

async function main() {
  Logger.initialize('token-summary');
  
  // Load config
  Logger.log('Loading config file: ' + configFileName);
  try {
    config = JSON.parse(fs.readFileSync(configFileName));
  } catch (err) {
    Logger.log('Error: unable to load ' + configFileName);
    Logger.log(err);
    process.exit(1);
  }

  // Initialize Solana connection
  connection = new Connection(config.solana.rpcUrl, 'confirmed');
  rpc = createRpc(config.solana.rpcUrl);

  // Connect to MongoDB
  mongoClient.init(__dirname, config.mongo.address, config.mongo.port, config.mongo.dbName);
  await mongoClient.connect(config.mongo.uri);
  Logger.log('MongoDB connection succeeded');

  // Initialize DAOs and start processing
  await setupTokenSummaryProcessing(mongoClient);
}

async function setupTokenSummaryProcessing(mongoClient) {
  // Initialize DAOs
  transactionDao = new transactionDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(transactionDao);

  accountTxDao = new accountTxDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(accountTxDao);

  smartContractDao = new smartContractDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(smartContractDao);

  tokenDao = new tokenDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(tokenDao);

  tokenSummaryDao = new tokenSummaryDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(tokenSummaryDao);

  tokenHolderDao = new tokenHolderDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(tokenHolderDao);

  // Start token summary updates
  await updateTokenSummaries();
}

async function updateTokenSummaries() {
  try {
    Logger.log('Starting token summary updates');
    
    // Get all tokens
    const tokens = await tokenDao.getAllTokensAsync();
    
    for (const token of tokens) {
      try {
        // Get compressed token data
        const compressedData = await rpc.getCompressedTokenAccount(
          new PublicKey(token.address)
        );

        // Get token holders
        const holders = await tokenHolderDao.getTokenHoldersCountAsync(token.address);

        // Get total supply from compressed data
        const totalSupply = compressedData?.account?.amount || '0';

        // Get transaction count
        const txCount = await transactionDao.getTokenTransactionCountAsync(token.address);

        // Update token summary
        const summary = {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          totalSupply,
          holders,
          txCount,
          lastUpdated: new Date(),
          isCompressed: !!compressedData,
          compressedData: compressedData || null
        };

        await tokenSummaryDao.updateTokenSummaryAsync(summary);
        Logger.log(`Updated summary for token ${token.address}`);

      } catch (error) {
        Logger.error(`Error updating token ${token.address}:`, error);
        continue; // Continue with next token
      }
    }

    Logger.log('Completed token summary updates');

  } catch (error) {
    Logger.error('Error in updateTokenSummaries:', error);
    throw error;
  }
}

async function updateTokenMetadata() {
  try {
    Logger.log('Starting token metadata updates');
    
    const tokens = await tokenDao.getAllTokensAsync();
    
    for (const token of tokens) {
      try {
        // Get token metadata from Solana
        const metadata = await connection.getParsedAccountInfo(
          new PublicKey(token.address)
        );

        if (!metadata?.value?.data?.parsed) {
          continue;
        }

        const { name, symbol, decimals } = metadata.value.data.parsed.info;

        // Update token metadata
        await tokenDao.updateTokenMetadataAsync(token.address, {
          name,
          symbol,
          decimals
        });

        Logger.log(`Updated metadata for token ${token.address}`);

      } catch (error) {
        Logger.error(`Error updating metadata for token ${token.address}:`, error);
        continue;
      }
    }

    Logger.log('Completed token metadata updates');

  } catch (error) {
    Logger.error('Error in updateTokenMetadata:', error);
    throw error;
  }
}

async function updateCompressedTokens() {
  try {
    Logger.log('Starting compressed token updates');
    
    const tokens = await tokenDao.getAllTokensAsync();
    
    for (const token of tokens) {
      try {
        // Get compressed token account
        const compressedData = await rpc.getCompressedTokenAccount(
          new PublicKey(token.address)
        );

        if (compressedData) {
          await tokenDao.updateTokenCompressionAsync(token.address, compressedData);
          Logger.log(`Updated compression data for token ${token.address}`);
        }

      } catch (error) {
        Logger.error(`Error updating compression data for token ${token.address}:`, error);
        continue;
      }
    }

    Logger.log('Completed compressed token updates');

  } catch (error) {
    Logger.error('Error in updateCompressedTokens:', error);
    throw error;
  }
}

// Error handling and cleanup
process.on('unhandledRejection', (error) => {
  Logger.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  Logger.log('SIGTERM received. Cleaning up...');
  await mongoClient.close();
  process.exit(0);
});

// Start the process
main().catch(error => {
  Logger.error('Error in main:', error);
  process.exit(1);
});

module.exports = {
  updateTokenSummaries,
  updateTokenMetadata,
  updateCompressedTokens
};