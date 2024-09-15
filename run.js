// run.js
const { startServer } = require('./index');
const ZKTorrentService = require('./services/zkTorrentService');
const TorrentPrivacyTools = require('./privacy/torrent_privacy_tools');
const { initializeSolanaConnection } = require('../utils/solanaUtils');
const { initializeNeonEVM } = require('../utils/neonEVMUtils');
const { setupWormholebridge } = require('../services/wormholeBridgeService');
const logger = require('./utils/logger');
var fs = require('fs')
var express = require('express');
var app = express();
var compression = require('compression')
var downloader = require('./helper/solcDownloader');

var smartContractRouter = require("./routes/smartContractRouter")
var cors = require('cors');

//------------------------------------------------------------------------------
//  Global variables
//------------------------------------------------------------------------------
var config = null;
var configFileName = 'config.cfg';
//------------------------------------------------------------------------------
//  Start from here
//------------------------------------------------------------------------------
var fs = require('fs')
var express = require('express');
var app = express();
var compression = require('compression')

var bluebird = require("bluebird");
var rpc = require('./api/rpc');
var scApi = require('./api/smart-contract-api');
var mongoClient = require('../mongo-db/mongo-client.js')
var blockDaoLib = require('../mongo-db/block-dao.js');
var progressDaoLib = require('../mongo-db/progress-dao.js');
var transactionDaoLib = require('../mongo-db/transaction-dao.js');
var accountDaoLib = require('../mongo-db/account-dao.js');
var accountTxDaoLib = require('../mongo-db/account-tx-dao.js');
var stakeDaoLib = require('../mongo-db/stake-dao.js');
var subStakeDaoLib = require('../mongo-db/sub-stake-dao.js');
var priceDaoLib = require('../mongo-db/price-dao.js');
var txHistoryDaoLib = require('../mongo-db/tx-history-dao.js');
var accountingDaoLib = require('../mongo-db/accounting-dao.js');
var checkpointDaoLib = require('../mongo-db/checkpoint-dao.js');
var smartContractDaoLib = require('../mongo-db/smart-contract-dao.js')
var activeAccountDaoLib = require('../mongo-db/active-account-dao.js')
var rewardDistributionDaoLib = require('../mongo-db/reward-distribution-dao.js')
var dailyTfuelBurntDaoLib = require('../mongo-db/daily-tfuel-burnt-dao')
var stakeHistoryDaoLib = require('../mongo-db/stake-history-dao.js')
var tokenDaoLib = require('../mongo-db/token-dao.js')
var tokenSummaryDaoLib = require('../mongo-db/token-summary-dao.js')
var tokenHolderDaoLib = require('../mongo-db/token-holder-dao.js')

var Theta = require('./libs/Theta');

var blocksRouter = require("./routes/blocksRouter");
var transactionsRouter = require("./routes/transactionsRouter");
var accountRouter = require("./routes/accountRouter");
var accountTxRouter = require("./routes/accountTxRouter");
var stakeRouter = require("./routes/stakeRouter");
var priceRouter = require("./routes/priceRouter");
var accountingRouter = require("./routes/accountingRouter");
var supplyRouter = require("./routes/supplyRouter");
var smartContractRouter = require("./routes/smartContractRouter");
var activeActRouter = require("./routes/activeActRouter");
var rewardDistributionRouter = require("./routes/rewardDistributionRouter");
var tokenRouter = require("./routes/tokenRouter");
var cors = require('cors');
var io;
//------------------------------------------------------------------------------
//  Global variables
//------------------------------------------------------------------------------
var Redis = require("ioredis");
var redis = null;
var redisConfig = null;

var config = null;
var configFileName = 'config.cfg';
var blockDao = null;

var progressDao = null
var transactionDao = null;
var accountDao = null;
var accountTxDao = null;
var stakeDao = null;
var subStakeDao = null;
var priceDao = null;
var txHistoryDao = null;
var accountingDao = null;
var checkpointDao = null;
var smartContractDao = null;
var isPushingData = false;
var schedule = require('node-schedule-tz');
var bluebird = require("bluebird");
var fs = require('fs');
var rpc = require('./api/rpc.js');
var scApi = require('./api/smart-contract-api.js');
var Logger = require('./helper/logger');
var mongoClient = require('../mongo-db/mongo-client.js')
var progressDaoLib = require('../mongo-db/progress-dao.js');
var blockDaoLib = require('../mongo-db/block-dao.js');
var transactionDaoLib = require('../mongo-db/transaction-dao.js');
var accountDaoLib = require('../mongo-db/account-dao.js');
var accountTxDaoLib = require('../mongo-db/account-tx-dao.js');
var stakeDaoLib = require('../mongo-db/stake-dao.js');
var subStakeDaoLib = require('../mongo-db/sub-stake-dao.js');
var txHistoryDaoLib = require('../mongo-db/tx-history-dao.js');
var accountingDaoLib = require('../mongo-db/accounting-dao.js');
var checkpointDaoLib = require('../mongo-db/checkpoint-dao.js');
var smartContractDaoLib = require('../mongo-db/smart-contract-dao.js')
var activeAccountDaoLib = require('../mongo-db/active-account-dao')
var totalAccountDaoLib = require('../mongo-db/total-account-dao')
var dailyAccountDaoLib = require('../mongo-db/daily-account-dao.js')
var rewardDistributionDaoLib = require('../mongo-db/reward-distribution-dao.js')
var dailyTfuelBurntDaoLib = require('../mongo-db/daily-tfuel-burnt-dao')
var stakeHistoryDaoLib = require('../mongo-db/stake-history-dao.js')
var tokenDaoLib = require('../mongo-db/token-dao.js')
var tokenSummaryDaoLib = require('../mongo-db/token-summary-dao.js')
var tokenHolderDaoLib = require('../mongo-db/token-holder-dao.js')

var Redis = require("ioredis");
var redis = null;
var redisConfig = null;
var cacheConfig = null; // node local cache configuration
var cacheEnabled = false;

var readBlockCronJob = require('./jobs/read-block.js');
var readPreFeeCronJob = require('./jobs/read-previous-fee.js');
var readTxHistoryJob = require('./jobs/read-tx-history.js');
var accountingJob = require('./jobs/accounting.js');
var accountJob = require('./jobs/read-accounts.js');
var express = require('express');
var app = express();
var cors = require('cors');

var Theta = require('./libs/Theta');

//------------------------------------------------------------------------------
//  Global variables
//------------------------------------------------------------------------------
var config = null;
var configFileName = 'config.cfg'
var blockDao = null;
var rewardDistributionDao = null;

//------------------------------------------------------------------------------
//  Start from here
//------------------------------------------------------------------------------
main();

//------------------------------------------------------------------------------
//  All the implementation goes below
//------------------------------------------------------------------------------

function main() {
  Logger.initialize()
  // load config
  Logger.log('Loading config file: ' + configFileName)
  try {
    config = JSON.parse(fs.readFileSync(configFileName));
  } catch (err) {
    Logger.log('Error: unable to load ' + configFileName);
    Logger.log(err);
    process.exit(1);
  }
  const networkId = config.blockchain.networkId;
  scApi.setConfig(config);
  rpc.setConfig(config);

  bluebird.promisifyAll(rpc);

  if (!config.defaultThetaChainID) {
    Logger.log('Error: unable to load config.defaultThetaChainID:', config.defaultThetaChainID);
    process.exit(1);
  }
  Theta.chainId = config.defaultThetaChainID;
  Logger.log('Theta.chainId:', Theta.chainId);

  redisConfig = config.redis;
  Logger.log("redisConfig:", redisConfig)
  cacheEnabled = config.nodeCache && config.nodeCache.enabled;
  Logger.log('cacheEnabled:', cacheEnabled);
  if (redisConfig && redisConfig.enabled) {
    redis = redisConfig.isCluster ? new Redis.Cluster([
      {
        host: redisConfig.host,
        port: redisConfig.port,
      },
    ], {
      redisOptions: {
        password: redisConfig.password,
      }
    }) : new Redis(redisConfig);
    bluebird.promisifyAll(redis);
    redis.on("connect", () => {
      Logger.log('connected to Redis');
    });
  }

  // connect to mongoDB
  mongoClient.init(__dirname, config.mongo.address, config.mongo.port, config.mongo.dbName);
  mongoClient.connect(config.mongo.uri, function (error) {
    if (error) {
      Logger.log('Mongo DB connection failed with err: ', error);
      process.exit();
    } else {
      Logger.log('Mongo DB connection succeeded');
      setupGetBlockCronJob(mongoClient, networkId);
    }
  });

  app.use(cors());
  app.get('/ping', function (req, res) {
    Logger.log('Receive healthcheck /ping from ELB - ' + req.connection.remoteAddress);
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Length': 2
    });
    res.write('OK');
    res.end();
  });
  var http = require('http').createServer(app);
  http.listen('8080', () => {
    Logger.log("rest api running on port. 8080");
  });
}

// function setupGetBlockCronJob(aerospikeClient) {
//   // initialize DAOs
//   progressDao = new progressDaoLib(__dirname, aerospikeClient);
//   bluebird.promisifyAll(progressDao);

//   blockDao = new blockDaoLib(__dirname, aerospikeClient);
//   bluebird.promisifyAll(blockDao);

//   transactionDao = new transactionDaoLib(__dirname, aerospikeClient);
//   bluebird.promisifyAll(transactionDao);

//   accountDao = new accountDaoLib(__dirname, aerospikeClient);
//   bluebird.promisifyAll(accountDao);

//   readBlockCronJob.Initialize(progressDao, blockDao, transactionDao, accountDao);
//   schedule.scheduleJob('* * * * * *', readBlockCronJob.Execute);
// }

function setupGetBlockCronJob(mongoClient, networkId) {
  // initialize DAOs
  progressDao = new progressDaoLib(__dirname, mongoClient, redis);
  bluebird.promisifyAll(progressDao);

  blockDao = new blockDaoLib(__dirname, mongoClient, redis);
  bluebird.promisifyAll(blockDao);

  transactionDao = new transactionDaoLib(__dirname, mongoClient, redis);
  bluebird.promisifyAll(transactionDao);

  accountDao = new accountDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(accountDao);

  accountTxDao = new accountTxDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(accountTxDao);

  stakeDao = new stakeDaoLib(__dirname, mongoClient, redis);
  bluebird.promisifyAll(stakeDao);

  subStakeDao = new subStakeDaoLib(__dirname, mongoClient, redis);
  bluebird.promisifyAll(subStakeDao);

  txHistoryDao = new txHistoryDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(txHistoryDao);

  accountingDao = new accountingDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(accountingDao);

  checkpointDao = new checkpointDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(checkpointDao);

  smartContractDao = new smartContractDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(smartContractDao);

  activeAccountDao = new activeAccountDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(activeAccountDao);

  totalAccountDao = new totalAccountDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(totalAccountDao);

  dailyAccountDao = new dailyAccountDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(dailyAccountDao);

  rewardDistributionDao = new rewardDistributionDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(rewardDistributionDao);

  dailyTfuelBurntDao = new dailyTfuelBurntDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(dailyTfuelBurntDao);

  stakeHistoryDao = new stakeHistoryDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(stakeHistoryDao);

  tokenDao = new tokenDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(tokenDao);

  tokenSummaryDao = new tokenSummaryDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(tokenSummaryDao);

  tokenHolderDao = new tokenHolderDaoLib(__dirname, mongoClient);
  bluebird.promisifyAll(tokenHolderDao);

  readPreFeeCronJob.Initialize(progressDao, blockDao, transactionDao);
  let readPreFeeTimer;
  readPreFeeTimer = setInterval(async function () {
    await readPreFeeCronJob.Execute(networkId, readPreFeeTimer);
  }, 1000);

  readBlockCronJob.Initialize(progressDao, blockDao, transactionDao, accountDao, accountTxDao, stakeDao,
    checkpointDao, smartContractDao, dailyAccountDao, rewardDistributionDao, stakeHistoryDao, tokenDao,
    tokenSummaryDao, tokenHolderDao, subStakeDao, cacheEnabled, config.maxBlockPerCrawl, config.chainType, config.contractAddressMap);
  setTimeout(async function run() {
    await readBlockCronJob.Execute(networkId);
    setTimeout(run, 1000);
  }, 1000);

  readTxHistoryJob.Initialize(transactionDao, txHistoryDao);
  schedule.scheduleJob('Record Transaction History', '0 0 0 * * *', 'America/Tijuana', readTxHistoryJob.Execute);
  setTimeout(async function run() {
    await readTxHistoryJob.Check();
    setTimeout(run, 1000 * 60 * 10);
  }, 1000);

  accountingJob.InitializeForTFuelPrice(accountingDao, config.accounting.coinmarketcapApiKey, config.accounting.walletAddresses);
  schedule.scheduleJob('Record TFuel Price', '0 0 0 * * *', 'Etc/GMT', accountingJob.RecordTFuelPrice); // GMT mid-night

  accountingJob.InitializeForTFuelEarning(transactionDao, accountTxDao, accountingDao, config.accounting.walletAddresses);
  schedule.scheduleJob('Record TFuel Earning', '0 0 0 * * *', 'America/Tijuana', accountingJob.RecordTFuelEarning); // PST mid-night

  accountJob.Initialize(dailyAccountDao, activeAccountDao, totalAccountDao, accountDao, dailyTfuelBurntDao);
  activeAccountDao.getLatestRecordsAsync(1)
    .then(() => { }).catch(err => {
      if (err.message.includes('NO_RECORD')) {
        accountJob.Execute();
      }
    })
  schedule.scheduleJob('Record active accounts', '0 0 0 * * *', 'America/Tijuana', accountJob.Execute); // PST mid-night
}
//------------------------------------------------------------------------------
//  Start from here
//------------------------------------------------------------------------------

main();

//------------------------------------------------------------------------------
//  All the implementation goes below
//------------------------------------------------------------------------------

function main() {
  console.log('Loading config file: ' + configFileName);
  try {
    config = JSON.parse(fs.readFileSync(configFileName));
  } catch (err) {
    console.log('Error: unable to load ' + configFileName);
    console.log(err);
    process.exit(1);
  }

  rpc.setConfig(config);
  scApi.setConfig(config);
  bluebird.promisifyAll(rpc);

  Theta.chainId = config.defaultThetaChainID;
  console.log('Theta.chainId:', Theta.chainId);

  redisConfig = config.redis;
  if (redisConfig && redisConfig.enabled) {
    redis = redisConfig.isCluster ? new Redis.Cluster([
      {
        host: redisConfig.host,
        port: redisConfig.port,
      },
    ], {
      redisOptions: {
        password: redisConfig.password,
      }
    }) : new Redis(redisConfig);
    bluebird.promisifyAll(redis);
    redis.on("connect", () => {
      console.log('connected to Redis');
    });
  }

  mongoClient.init(__dirname, config.mongo.address, config.mongo.port, config.mongo.dbName);
  mongoClient.connect(config.mongo.uri, function (err) {
    if (err) {
      console.log('Mongo connection failed');
      process.exit(1);
    } else {
      console.log('Mongo connection succeeded');
      blockDao = new blockDaoLib(__dirname, mongoClient, redis);
      bluebird.promisifyAll(blockDao);
      progressDao = new progressDaoLib(__dirname, mongoClient, redis);
      bluebird.promisifyAll(progressDao);
      transactionDao = new transactionDaoLib(__dirname, mongoClient, redis);
      bluebird.promisifyAll(transactionDao);
      accountDao = new accountDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(accountDao);
      accountTxDao = new accountTxDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(accountTxDao);
      stakeDao = new stakeDaoLib(__dirname, mongoClient, redis);
      bluebird.promisifyAll(stakeDao);
      subStakeDao = new subStakeDaoLib(__dirname, mongoClient, redis);
      bluebird.promisifyAll(subStakeDao);
      priceDao = new priceDaoLib(__dirname, mongoClient, redis);
      bluebird.promisifyAll(priceDao);
      txHistoryDao = new txHistoryDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(txHistoryDao);
      accountingDao = new accountingDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(accountingDao);
      checkpointDao = new checkpointDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(checkpointDao);
      smartContractDao = new smartContractDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(smartContractDao);
      activeActDao = new activeAccountDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(activeActDao);
      rewardDistributionDao = new rewardDistributionDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(rewardDistributionDao);
      dailyTfuelBurntDao = new dailyTfuelBurntDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(dailyTfuelBurntDao);
      stakeHistoryDao = new stakeHistoryDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(stakeHistoryDao);
      tokenDao = new tokenDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(tokenDao);
      tokenSummaryDao = new tokenSummaryDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(tokenSummaryDao);
      tokenHolderDao = new tokenHolderDaoLib(__dirname, mongoClient);
      bluebird.promisifyAll(tokenHolderDao);
      //

      app.use(compression());
      app.use(cors());
      app.use(setApiToken);


      app.get('/', function (req, res) {
        console.log('Receive healthcheck / from ELB - ' + req.connection.remoteAddress);
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': 2
        });
        res.write('OK');
        res.end();
      });

      app.get('/ping', function (req, res) {
        console.log('Receive healthcheck /ping from ELB - ' + req.connection.remoteAddress);
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': 2
        });
        res.write('OK');
        res.end();
      });


      var options = {};
      var restServer, socketIOServer;

      if (config.cert && config.cert.enabled) {
        var privateKey = fs.readFileSync(config.cert.key, 'utf8');
        var certificate = fs.readFileSync(config.cert.crt, 'utf8');
        options = {
          key: privateKey,
          cert: certificate
        };
        var spdy = require('spdy');
        restServer = spdy.createServer(options, app);
        socketIOServer = spdy.createServer(options, app);
      } else {
        var http = require('http');
        restServer = http.createServer(app);
        socketIOServer = http.createServer(app);
      }

      // start server program
      io = require('socket.io')(socketIOServer);
      io.on('connection', onClientConnect);

      socketIOServer.listen(config.server.socketIOPort || '2096', () => {
        console.log("socket.IO api running on port.", config.server.socketIOPort || '2096');
      });

      // app.use(bodyParser.json());
      // app.use(bodyParser.urlencoded({ extended: true }));

      restServer.listen(config.server.port, () => {
        console.log("rest api running on port.", config.server.port);
      });

      // blocks router
      blocksRouter(app, blockDao, progressDao, checkpointDao, config);
      // transactions router       
      transactionsRouter(app, transactionDao, blockDao, progressDao, txHistoryDao, config);
      // account router
      accountRouter(app, accountDao, tokenDao, rpc, config);
      // account transaction mapping router
      accountTxRouter(app, accountDao, accountTxDao, transactionDao);
      // stake router
      stakeRouter(app, stakeDao, subStakeDao, blockDao, accountDao, progressDao, stakeHistoryDao, config);
      // supply router
      supplyRouter(app, progressDao, dailyTfuelBurntDao, rpc, config);
      // price router
      priceRouter(app, priceDao, progressDao, config)
      // accounting router
      accountingRouter(app, accountingDao)
      // smart contract router
      smartContractRouter(app, smartContractDao, transactionDao, accountTxDao, tokenDao, tokenSummaryDao, tokenHolderDao)
      // active account router
      activeActRouter(app, activeActDao);
      // reward distribution router
      rewardDistributionRouter(app, rewardDistributionDao);
      // token router
      tokenRouter(app, tokenDao, tokenSummaryDao, tokenHolderDao, config);
      // keep push block data
      // pushTopBlocks();
    }
  });

}

function onClientConnect(client) {
  console.log('client connected.');
  isPushingData = true;
  pushTopBlocks();
  pushTopTransactions();
  pushTotalTxsNum();
  // setup client event listeners
  client.on('disconnect', onClientDisconnect);
}

function pushTopBlocks() {
  const numberOfBlocks = 5;

  progressDao.getProgressAsync(config.blockchain.networkId)
    .then(function (progressInfo) {
      latest_block_height = progressInfo.height;
      // console.log('Latest block height: ' + latest_block_height.toString());

      var query_block_height_max = latest_block_height;
      var query_block_height_min = Math.max(0, query_block_height_max - numberOfBlocks + 1); // pushing 50 blocks initially
      // console.log('Querying blocks from ' + query_block_height_min.toString() + ' to ' + query_block_height_max.toString())
      //return blockDao.getBlockAsync(123) 
      return blockDao.getBriefBlocksByRangeAsync(query_block_height_min, query_block_height_max)
    })
    .then(function (blockInfoList) {
      io.sockets.emit('PUSH_TOP_BLOCKS', { type: 'block_list', body: blockInfoList });
    });

  if (isPushingData) setTimeout(pushTopBlocks, 1000);
}
function pushTopTransactions() {
  const numberOfTransactions = 5;
  transactionDao.getBriefTransactionsAsync(0, numberOfTransactions)
    .then(function (transactionInfoList) {
      io.sockets.emit('PUSH_TOP_TXS', { type: 'transaction_list', body: transactionInfoList });
    });
  if (isPushingData) setTimeout(pushTopTransactions, 1000);
}

function pushTotalTxsNum() {
  transactionDao.getTotalNumberByHourAsync(null)
    .then(number => {
      io.sockets.emit('PUSH_TOTAL_NUM_TXS', { type: 'total_number_transaction', body: { total_num_tx: number } });
    })
    .catch(err => {
      console.log('Error - Push total number of transaction', err);
    });
  if (isPushingData) setTimeout(pushTotalTxsNum, 1000);
}
function onClientDisconnect() {
  isPushingData = false;
  console.log('client disconnect');
}

function setApiToken(req, res, next) {
  const apiToken = req.header('x-api-token');
  if (apiToken !== undefined) {
    res.setHeader('x-api-token', apiToken);
  }
  next();
}
main();

//------------------------------------------------------------------------------
//  All the implementation goes below
//------------------------------------------------------------------------------

function main() {
  console.log('Loading config file: ' + configFileName);
  try {
    config = JSON.parse(fs.readFileSync(configFileName));
  } catch (err) {
    console.log('Error: unable to load ' + configFileName);
    console.log(err);
    process.exit(1);
  }

  app.use(cors());
  app.use(compression());

  app.get('/ping', function (req, res) {
    console.log('Receive healthcheck /ping from ELB - ' + req.connection.remoteAddress);
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Length': 2
    });
    res.write('OK');
    res.end();
  });


  var http = require('http').createServer(app);
  http.listen(config.server.port, () => {
    console.log("rest api running on port.", config.server.port);
  });

  // REST services
  // smart contract router
  smartContractRouter(app);

  if(config.shouldDownloadAll)  downloader.downloadAll('./libs');
}
async function initializeServices() {
  try {
    logger.info('Initializing ZKTorrentService...');
    const zkTorrentService = new ZKTorrentService();
    await zkTorrentService.initialize();

    logger.info('Initializing TorrentPrivacyTools...');
    const torrentPrivacyTools = new TorrentPrivacyTools();
    await torrentPrivacyTools.initialize();

    logger.info('Initializing Solana connection...');
    await initializeSolanaConnection();

    logger.info('Initializing Neon EVM...');
    await initializeNeonEVM();

    logger.info('Setting up Wormhole bridge...');
    await setupWormholebridge();

    return { zkTorrentService, torrentPrivacyTools };
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

async function run() {
  try {
    const services = await initializeServices();
    const port = process.env.PORT || 3000;
    await startServer(port, services);
    logger.info(`Server is running on port ${port}`);
  } catch (error) {
    logger.error('Failed to start the server:', error);
    process.exit(1);
  }
}

run();