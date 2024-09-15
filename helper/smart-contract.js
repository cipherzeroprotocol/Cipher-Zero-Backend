var { getHex } = require('./utils');
var { ethers } = require("ethers");
var Theta = require('../libs/Theta');
var ThetaJS = require('../libs/thetajs.esm');
var smartContractApi = require('../api/smart-contract-api');
var get = require('lodash/get');
var map = require('lodash/map');
const { default: axios } = require('axios');
var BigNumber = require('bignumber.js');

const ZeroAddress = '0x0000000000000000000000000000000000000000';
const EventHashMap = {
  TRANSFER: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
}
var get = require('lodash/get');
var map = require('lodash/map');
var BigNumber = require('bignumber.js');
var Theta = require('../libs/Theta');
var ThetaJS = require('../libs/thetajs.esm');
var smartContractApi = require('../api/smart-contract-api');
var { ZeroAddress, EventHashMap, CommonEventABIs } = require('./constants');
var { getHex } = require('./utils');
var { ethers } = require("ethers");
var Logger = require('./logger');
const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { Program } = require('@project-serum/anchor');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { ethers } = require('ethers');
const axios = require('axios');
const Logger = require('./logger');

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

exports.checkTokenStandard = function(abi) {
  const requiredFunctions = [
    'balanceOf', 'transfer', 'transferFrom', 'approve', 'allowance',
    'totalSupply', 'name', 'symbol', 'decimals'
  ];
  
  const requiredEvents = ['Transfer', 'Approval'];
  
  const hasAllFunctions = requiredFunctions.every(func => 
    abi.some(item => item.type === 'function' && item.name === func)
  );
  
  const hasAllEvents = requiredEvents.every(event => 
    abi.some(item => item.type === 'event' && item.name === event)
  );
  
  return hasAllFunctions && hasAllEvents;
}

exports.decodeLog = function(log, abi) {
  const iface = new ethers.utils.Interface(abi);
  try {
    const decoded = iface.parseLog(log);
    return {
      name: decoded.name,
      args: decoded.args
    };
  } catch (error) {
    Logger.error('Error decoding log:', error);
    return null;
  }
}

exports.callContractMethod = async function(programId, methodName, args) {
  try {
    const program = await Program.at(new PublicKey(programId), connection);
    const result = await program.rpc[methodName](...args);
    return result;
  } catch (error) {
    Logger.error(`Error calling contract method ${methodName}:`, error);
    throw error;
  }
}

exports.getTokenMetadata = async function(mint) {
  try {
    const metadataPDA = await PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        TOKEN_PROGRAM_ID.toBuffer(),
        new PublicKey(mint).toBuffer(),
      ],
      new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s') // Metadata program ID
    );
    const accountInfo = await connection.getAccountInfo(metadataPDA[0]);
    if (accountInfo) {
      // Parse metadata here
      // This is a simplified example; you'd need to implement proper deserialization
      const metadata = JSON.parse(accountInfo.data);
      return metadata;
    }
    return null;
  } catch (error) {
    Logger.error('Error fetching token metadata:', error);
    return null;
  }
}

exports.estimateTransactionFee = async function(transaction) {
  try {
    const { blockhash } = await connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    const simulation = await connection.simulateTransaction(transaction);
    return simulation.value.feeCalculator.lamportsPerSignature;
  } catch (error) {
    Logger.error('Error estimating transaction fee:', error);
    throw error;
  }
}

exports.getTokenSupply = async function(tokenMint) {
  try {
    const supply = await connection.getTokenSupply(new PublicKey(tokenMint));
    return supply.value.uiAmount;
  } catch (error) {
    Logger.error('Error getting token supply:', error);
    throw error;
  }
}

exports.isContract = async function(address) {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(address));
    return accountInfo !== null && accountInfo.owner.equals(new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111'));
  } catch (error) {
    Logger.error('Error checking if address is a contract:', error);
    return false;
  }
}

exports.getContractAbi = async function(address) {
  try {
    const accountInfo = await connection.getAccountInfo(new PublicKey(address));
    if (accountInfo) {
      const abi = JSON.parse(accountInfo.data);
      return abi;
    }
    return null;
  } catch (error) {
    Logger.error('Error getting contract ABI:', error);
    return null;
  }
}
exports.updateToken = async function (tx, smartContractDao, tokenDao, tokenSummaryDao, tokenHolderDao) {
  let addressList = _getContractAddressSet(tx);
  if (addressList.length === 0) {
    return;
  }
  let infoMap = {};
  // Generate info map
  for (let address of addressList) {
    infoMap[`${address}`] = {};
    const abiRes = await smartContractDao.getAbiAsync(address);
    const abi = get(abiRes[0], 'abi');
    if (!abi) {
      infoMap[`${address}`].abi = [];
      infoMap[`${address}`].type = 'unknown';
    } else {
      infoMap[`${address}`].abi = abi;
      infoMap[`${address}`].type = _checkTnt721(abi) ? 'TNT-721' : _checkTnt20(abi) ? 'TNT-20' : 'unknown';
      const tokenInfo = await tokenSummaryDao.getInfoByAddressAsync(address);
      infoMap[`${address}`].tokenName = get(tokenInfo, 'tokenName');
    }
  }
  Logger.log('Info map:', infoMap);
  let logs = get(tx, 'receipt.Logs');
  logs = JSON.parse(JSON.stringify(logs));
  logs = logs.map(obj => {
    obj.data = getHex(obj.data);
    return obj;
  })
  // Logger.log('logs in updateTokenNew:', logs)
  const tokenArr = [];
  logs = _decodeLogs(logs, infoMap);
  const insertList = [];
  for (let [i, log] of logs.entries()) {
    switch (get(log, 'topics[0]')) {
      case EventHashMap.TFUEL_SPLIT:
        if (typeof get(log, 'decode') !== "object") {
          log = decodeLogByAbiHash(log, EventHashMap.TFUEL_SPLIT);
          let sellerInfo = {
            _id: tx.hash.toLowerCase() + i + '_0',
            hash: tx.hash.toLowerCase(),
            from: get(tx, 'data.from.address').toLowerCase(),
            to: get(log, 'decode.result[0]').toLowerCase(),
            value: get(log, 'decode.result[1]'),
            type: 'TFUEL',
            timestamp: tx.timestamp,
          }
          let platformInfo = {
            _id: tx.hash.toLowerCase() + i + '_1',
            hash: tx.hash.toLowerCase(),
            from: get(tx, 'data.from.address').toLowerCase(),
            to: get(log, 'decode.result[2]').toLowerCase(),
            value: get(log, 'decode.result[3]'),
            type: 'TFUEL',
            timestamp: tx.timestamp,
          }
          tokenArr.push(sellerInfo, platformInfo);
          insertList.push(_checkAndInsertToken(sellerInfo, tokenDao), _checkAndInsertToken(platformInfo, tokenDao))
        }
        break;
      case EventHashMap.TRANSFER:
        const contractAddress = get(log, 'address');
        if (contractList.indexOf(contractAddress) > -1) {
          let type = '';
          if (contractMap.TNT20TokenBank.indexOf(contractAddress) !== -1) {
            type = 'XCHAIN_TNT20'
          } else if (contractMap.TNT721TokenBank.indexOf(contractAddress) !== -1) {
            type = 'XCHAIN_TNT721'
          }
          log = decodeLogByAbiHash(log, EventHashMap.TRANSFER);
          const tokenId = get(log, 'decode.result.tokenId');
          const value = tokenId !== undefined ? 1 : get(log, 'decode.result[2]');
          const newToken = {
            _id: tx.hash.toLowerCase() + i,
            hash: tx.hash.toLowerCase(),
            from: (get(log, 'decode.result[0]') || '').toLowerCase(),
            to: (get(log, 'decode.result[1]') || '').toLowerCase(),
            token_id: tokenId,
            value,
            name: get(infoMap, `${contractAddress}.name`),
            type: type,
            timestamp: tx.timestamp,
            contract_address: contractAddress
          }
          tokenArr.push(newToken);
          insertList.push(_checkAndInsertToken(newToken, tokenDao))
          continue;
        }
        // If log.address === tx.receipt.ContractAddress, and the contract has not been verified
        // this record will be hanlded in the contract verification
        if (get(infoMap, `${contractAddress}.type`) === 'unknow' && contractAddress === get(tx, 'receipt.ContractAddress')) {
          continue;
        }
        const tokenId = get(log, 'decode.result.tokenId');
        const value = tokenId !== undefined ? 1 : get(log, 'decode.result[2]');
        const newToken = {
          _id: tx.hash.toLowerCase() + i,
          hash: tx.hash.toLowerCase(),
          from: (get(log, 'decode.result[0]') || '').toLowerCase(),
          to: (get(log, 'decode.result[1]') || '').toLowerCase(),
          token_id: tokenId,
          value,
          name: get(infoMap, `${contractAddress}.name`),
          type: get(infoMap, `${contractAddress}.type`),
          timestamp: tx.timestamp,
          contract_address: contractAddress
        }
        tokenArr.push(newToken);
        insertList.push(_checkAndInsertToken(newToken, tokenDao))
        break;
      default:
        break;
    }
  }
  // Logger.log('tokenArr:', JSON.stringify(tokenArr));
  await updateTokenSummary(tokenArr, infoMap, tokenSummaryDao, tokenHolderDao);
  return Promise.all(insertList);
}

exports.updateTokenByTxs = async function (txs, smartContractDao, tokenDao, tokenSummaryDao,
  tokenHolderDao, contractMap, chainType) {
  const isMainChain = chainType === 'mainchain';
  const chainName = isMainChain ? 'mainchain' : 'subchain';
  const xChainName = isMainChain ? 'subchain' : 'mainchain';
  const contractList = Object.keys(contractMap).map(name => contractMap[name]);
  let addressList = _getContractAddressSetByTxs(txs);
  // Logger.log('addressList.length:', addressList.length, JSON.stringify(addressList));
  if (addressList.length === 0) {
    return;
  }
  let infoMap = {};
  // Generate info map
  for (let address of addressList) {
    infoMap[`${address}`] = {};
    const abiRes = await smartContractDao.getAbiAsync(address);
    const abi = get(abiRes[0], 'abi');
    if (!abi) {
      infoMap[`${address}`].abi = [];
      infoMap[`${address}`].type = 'unknown';
    } else {
      infoMap[`${address}`].abi = abi;
      infoMap[`${address}`].type = _checkTnt721(abi) ? 'TNT-721' : _checkTnt20(abi) ? 'TNT-20' : 'unknown';
      const tokenInfo = await tokenSummaryDao.getInfoByAddressAsync(address);
      infoMap[`${address}`].tokenName = get(tokenInfo, 'tokenName');
    }
  }
  Logger.log('Info map keys length:', Object.keys(infoMap).length);
  const tokenArr = [];
  const insertList = [];
  for (let tx of txs) {
    let logs = get(tx, 'receipt.Logs');
    logs = JSON.parse(JSON.stringify(logs));
    logs = logs.map(obj => {
      obj.data = getHex(obj.data);
      return obj;
    })
    logs = _decodeLogs(logs, infoMap);
    // Logger.log('logs in updateTokenNew:', JSON.stringify(logs))
    for (let [i, log] of logs.entries()) {
      const contractAddress = get(log, 'address');
      console.log('chainType:', chainType, '.contractMap.TFuelTokenBank:', contractMap.TFuelTokenBank);
      switch (get(log, 'topics[0]')) {
        case EventHashMap.TFUEL_SPLIT:
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TFUEL_SPLIT);
            let sellerInfo = {
              _id: tx.hash.toLowerCase() + i + '_0',
              hash: tx.hash.toLowerCase(),
              from: get(tx, 'data.from.address').toLowerCase(),
              to: get(log, 'decode.result[0]').toLowerCase(),
              value: get(log, 'decode.result[1]'),
              type: 'TFUEL',
              timestamp: tx.timestamp,
            }
            let platformInfo = {
              _id: tx.hash.toLowerCase() + i + '_1',
              hash: tx.hash.toLowerCase(),
              from: get(tx, 'data.from.address').toLowerCase(),
              to: get(log, 'decode.result[2]').toLowerCase(),
              value: get(log, 'decode.result[3]'),
              type: 'TFUEL',
              timestamp: tx.timestamp,
            }
            tokenArr.push(sellerInfo, platformInfo);
            insertList.push(_checkAndInsertToken(sellerInfo, tokenDao), _checkAndInsertToken(platformInfo, tokenDao))
          }
          break;
        case EventHashMap.TRANSFER:
          // If log.address === tx.receipt.ContractAddress, and the contract has not been verified
          // this record will be hanlded in the contract verification
          if (get(infoMap, `${contractAddress}.type`) === 'unknow' && contractAddress === get(tx, 'receipt.ContractAddress')) {
            continue;
          }
          const tokenId = get(log, 'decode.result.tokenId');
          const value = tokenId !== undefined ? 1 : get(log, 'decode.result[2]');
          const newToken = {
            _id: tx.hash.toLowerCase() + i,
            hash: tx.hash.toLowerCase(),
            from: (get(log, 'decode.result[0]') || '').toLowerCase(),
            to: (get(log, 'decode.result[1]') || '').toLowerCase(),
            token_id: tokenId,
            value,
            name: get(infoMap, `${contractAddress}.name`),
            type: get(infoMap, `${contractAddress}.type`),
            timestamp: tx.timestamp,
            contract_address: contractAddress
          }
          tokenArr.push(newToken);
          insertList.push(_checkAndInsertToken(newToken, tokenDao))
          break;
        case EventHashMap.TFUEL_VOUCHER_MINTED:
          if (contractMap.TFuelTokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TFUEL_VOUCHER_MINTED);
            Logger.log('Decoded TFUEL_VOUCHER_MINTED Log:', JSON.stringify(log));
            const chainId = get(log, 'decode.result[0]').split('/')[0];
            let xTfuelInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: chainId,
              to: get(log, 'decode.result[1]').toLowerCase(),
              value: get(log, 'decode.result[2]'),
              type: 'XCHAIN_TFUEL',
              timestamp: tx.timestamp,
            }
            tokenArr.push(xTfuelInfo);
            insertList.push(_checkAndInsertToken(xTfuelInfo, tokenDao))
          }
          break;
        case EventHashMap.TFUEL_VOUCHER_BURNED:
          if (contractMap.TFuelTokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TFUEL_VOUCHER_BURNED);
            Logger.log('Decoded TFUEL_VOUCHER_BURNED Log:', JSON.stringify(log));
            const chainId = get(log, 'decode.result[0]').split('/')[0];
            let xTfuelInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: get(log, 'decode.result[1]').toLowerCase(),
              to: get(log, 'decode.result[2]').toLowerCase() + '_' + chainId,
              value: get(log, 'decode.result[3]'),
              type: 'XCHAIN_TFUEL',
              timestamp: tx.timestamp,
            }
            tokenArr.push(xTfuelInfo);
            insertList.push(_checkAndInsertToken(xTfuelInfo, tokenDao))
          }
          break;
        case EventHashMap.TFUEL_TOKEN_LOCKED:
          if (contractMap.TFuelTokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TFUEL_TOKEN_LOCKED);
            Logger.log('Decoded TFUEL_TOKEN_LOCKED Log:', JSON.stringify(log));
            let xTfuelInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: get(log, 'decode.result[1]').toLowerCase(),
              to: get(log, 'decode.result[3]').toLowerCase() + '_' + get(log, 'decode.result[2]'),
              value: get(log, 'decode.result[4]'),
              type: 'XCHAIN_TFUEL',
              timestamp: tx.timestamp,
            }
            tokenArr.push(xTfuelInfo);
            insertList.push(_checkAndInsertToken(xTfuelInfo, tokenDao))
          }
          break;
        case EventHashMap.TFUEL_TOKEN_UNLOCKED:
          if (contractMap.TFuelTokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TFUEL_TOKEN_UNLOCKED);
            Logger.log('Decoded TFUEL_TOKEN_UNLOCKED Log:', JSON.stringify(log));
            let xTfuelInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: xChainName,
              to: get(log, 'decode.result[1]').toLowerCase(),
              value: get(log, 'decode.result[2]'),
              type: 'XCHAIN_TFUEL',
              timestamp: tx.timestamp,
            }
            tokenArr.push(xTfuelInfo);
            insertList.push(_checkAndInsertToken(xTfuelInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT20_VOUCHER_MINTED:
          if (contractMap.TNT20TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT20_VOUCHER_MINTED);
            Logger.log('Decoded TNT20_VOUCHER_MINTED Log:', JSON.stringify(log));
            const chainId = get(log, 'decode.result[0]').split('/')[0];
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: chainId,
              to: get(log, 'decode.result[1]').toLowerCase(),
              value: get(log, 'decode.result[3]'),
              type: 'XCHAIN_TNT20',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT20_VOUCHER_BURNED:
          if (contractMap.TNT20TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT20_VOUCHER_BURNED);
            Logger.log('Decoded TNT20_VOUCHER_BURNED Log:', JSON.stringify(log));
            const chainId = get(log, 'decode.result[0]').split('/')[0];
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: get(log, 'decode.result[1]').toLowerCase(),
              to: get(log, 'decode.result[2]').toLowerCase() + '_' + chainId,
              value: get(log, 'decode.result[3]'),
              type: 'XCHAIN_TNT20',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT20_TOKEN_LOCKED:
          if (contractMap.TNT20TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT20_TOKEN_LOCKED);
            Logger.log('Decoded TNT20_TOKEN_LOCKED Log:', JSON.stringify(log));
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: get(log, 'decode.result[1]').toLowerCase(),
              to: get(log, 'decode.result[3]').toLowerCase() + '_' + get(log, 'decode.result[2]'),
              value: get(log, 'decode.result[4]'),
              type: 'XCHAIN_TNT20',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT20_TOKEN_UNLOCKED:
          if (contractMap.TNT20TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT20_TOKEN_UNLOCKED);
            Logger.log('Decoded TNT20_TOKEN_UNLOCKED Log:', JSON.stringify(log));
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: xChainName,
              to: get(log, 'decode.result[1]').toLowerCase(),
              value: get(log, 'decode.result[2]'),
              type: 'XCHAIN_TNT20',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT721_VOUCHER_MINTED:
          if (contractMap.TNT721TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT721_VOUCHER_MINTED);
            Logger.log('Decoded TNT721_VOUCHER_MINTED Log:', JSON.stringify(log));
            const chainId = get(log, 'decode.result[0]').split('/')[0];
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: chainId,
              to: get(log, 'decode.result[1]').toLowerCase(),
              token_id: get(log, 'decode.result[3]'),
              type: 'XCHAIN_TNT721',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT721_VOUCHER_BURNED:
          if (contractMap.TNT721TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT721_VOUCHER_BURNED);
            Logger.log('Decoded TNT721_VOUCHER_BURNED Log:', JSON.stringify(log));
            const chainId = get(log, 'decode.result[0]').split('/')[0];
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: get(log, 'decode.result[1]').toLowerCase(),
              to: get(log, 'decode.result[2]').toLowerCase() + '_' + chainId,
              token_id: get(log, 'decode.result[3]'),
              type: 'XCHAIN_TNT721',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT721_TOKEN_LOCKED:
          if (contractMap.TNT721TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT721_TOKEN_LOCKED);
            Logger.log('Decoded TNT721_TOKEN_LOCKED Log:', JSON.stringify(log));
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: get(log, 'decode.result[1]').toLowerCase(),
              to: get(log, 'decode.result[3]').toLowerCase() + '_' + get(log, 'decode.result[2]'),
              token_id: get(log, 'decode.result[4]'),
              type: 'XCHAIN_TNT721',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT721_TOKEN_UNLOCKED:
          if (contractMap.TNT721TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT721_TOKEN_UNLOCKED);
            Logger.log('Decoded TNT721_TOKEN_UNLOCKED Log:', JSON.stringify(log));
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: xChainName,
              to: get(log, 'decode.result[1]').toLowerCase(),
              token_id: get(log, 'decode.result[2]'),
              type: 'XCHAIN_TNT721',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT1155_VOUCHER_MINTED:
          if (contractMap.TNT1155TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT1155_VOUCHER_MINTED);
            Logger.log('Decoded TNT1155_VOUCHER_MINTED Log:', JSON.stringify(log));
            const chainId = get(log, 'decode.result[0]').split('/')[0];
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: chainId,
              to: get(log, 'decode.result[1]').toLowerCase(),
              token_id: get(log, 'decode.result[3]'),
              value: get(log, 'decode.result[4]'),
              type: 'XCHAIN_TNT1155',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT1155_VOUCHER_BURNED:
          if (contractMap.TNT1155TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT1155_VOUCHER_BURNED);
            Logger.log('Decoded TNT1155_VOUCHER_BURNED Log:', JSON.stringify(log));
            const chainId = get(log, 'decode.result[0]').split('/')[0];
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: get(log, 'decode.result[1]').toLowerCase(),
              to: get(log, 'decode.result[2]').toLowerCase() + '_' + chainId,
              token_id: get(log, 'decode.result[3]'),
              value: get(log, 'decode.result[4]'),
              type: 'XCHAIN_TNT1155',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT1155_TOKEN_LOCKED:
          if (contractMap.TNT1155TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT1155_TOKEN_LOCKED);
            Logger.log('Decoded TNT1155_TOKEN_LOCKED Log:', JSON.stringify(log));
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: get(log, 'decode.result[1]').toLowerCase(),
              to: get(log, 'decode.result[3]').toLowerCase() + '_' + get(log, 'decode.result[2]'),
              token_id: get(log, 'decode.result[4]'),
              value: get(log, 'decode.result[5]'),
              type: 'XCHAIN_TNT1155',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        case EventHashMap.TNT1155_TOKEN_UNLOCKED:
          if (contractMap.TNT1155TokenBank.indexOf(get(log, 'address')) === -1) break;
          if (typeof get(log, 'decode') !== "object") {
            log = decodeLogByAbiHash(log, EventHashMap.TNT1155_TOKEN_UNLOCKED);
            Logger.log('Decoded TNT1155_TOKEN_UNLOCKED Log:', JSON.stringify(log));
            let tokenInfo = {
              _id: tx.hash.toLowerCase() + i,
              hash: tx.hash.toLowerCase(),
              from: xChainName,
              to: get(log, 'decode.result[1]').toLowerCase(),
              token_id: get(log, 'decode.result[2]'),
              value: get(log, 'decode.result[3]'),
              type: 'XCHAIN_TNT1155',
              timestamp: tx.timestamp,
            }
            tokenArr.push(tokenInfo);
            insertList.push(_checkAndInsertToken(tokenInfo, tokenDao))
          }
          break;
        default:
          break;
      }
    }
  }
  // Logger.log('tokenArr.length:', tokenArr.length, 'tokenArr:', JSON.stringify(tokenArr));
  await updateTokenSummary(tokenArr, infoMap, tokenSummaryDao, tokenHolderDao);
  return Promise.all(insertList);
}

const _decodeLogs = function (logs, infoMap) {
  let ifaceMap = {};
  Object.keys(infoMap).forEach(k => ifaceMap[`${k}`] = new ethers.utils.Interface(infoMap[k].abi))
  return logs.map(log => {
    if (!infoMap[`${log.address}`]) {
      log.decode = 'No matched event or the smart contract source code has not been verified.';
      return log;
    }
    const iface = ifaceMap[`${log.address}`];
    const abi = infoMap[`${log.address}`].abi;
    try {
      let event = null;
      for (let i = 0; i < abi.length; i++) {
        let item = abi[i];
        if (item.type != "event") continue;
        const hash = iface.getEventTopic(item.name)
        if (hash == log.topics[0]) {
          event = item;
          break;
        }
      }
      if (event != null) {
        let bigNumberData = iface.decodeEventLog(event.name, log.data, log.topics);
        let data = {};
        Object.keys(bigNumberData).forEach(k => {
          data[k] = bigNumberData[k].toString();
        })
        log.decode = {
          result: data,
          eventName: event.name,
          event: event
        }
      } else {
        log.decode = 'No matched event or the smart contract source code has not been verified.';
      }
      return log;
    } catch (e) {
      log.decode = 'Something wrong while decoding, met error: ' + e;
      return log;
    }
  })
}
exports.decodeLogs = _decodeLogs;

const _checkTnt721 = function (abi) {
  const obj = {
    'balanceOf': { contains: false, type: 'function' },
    'ownerOf': { contains: false, type: 'function' },
    'safeTransferFrom': { contains: false, type: 'function' },
    'transferFrom': { contains: false, type: 'function' },
    'approve': { contains: false, type: 'function' },
    'setApprovalForAll': { contains: false, type: 'function' },
    'getApproved': { contains: false, type: 'function' },
    'isApprovedForAll': { contains: false, type: 'function' },
    'Transfer': { contains: false, type: 'event' },
    'Approval': { contains: false, type: 'event' },
    'ApprovalForAll': { contains: false, type: 'event' },
  }

  return _check(obj, abi);
}
exports.checkTnt721 = _checkTnt721;



const _checkTnt20 = function (abi) {
  const obj = {
    'name': { contains: false, type: 'function' },
    'symbol': { contains: false, type: 'function' },
    'decimals': { contains: false, type: 'function' },
    'totalSupply': { contains: false, type: 'function' },
    'balanceOf': { contains: false, type: 'function' },
    'transfer': { contains: false, type: 'function' },
    'transferFrom': { contains: false, type: 'function' },
    'approve': { contains: false, type: 'function' },
    'allowance': { contains: false, type: 'function' },
    'Transfer': { contains: false, type: 'event' },
    'Approval': { contains: false, type: 'event' },
  }

  return _check(obj, abi);
}
//exports.checkTnt20 = _checkTnt20;


function _check(obj, abi) {
  abi.forEach(o => {
    if (obj[o.name] !== undefined) {
      if (obj[o.name].type === o.type) {
        obj[o.name].contains = true
      }
    }
  })
  let res = true;
  for (let key in obj) {
    res = res && obj[key].contains
  }
  return res;
}


const _checkAndInsertToken = async function (token, tokenDao) {
  let hasToken = await tokenDao.checkTokenAsync(token._id)
  if (hasToken) return;
  await tokenDao.insertAsync(token);
}
exports.checkAndInsertToken = _checkAndInsertToken;


async function updateTokenSummary(tokenArr, infoMap, tokenSummaryDao, tokenHolderDao) {
  Logger.log('In updateTokenSummary')
  const tokenSummaryMap = {};

  // Generate tokenSummaryMap
  for (let address of Object.keys(infoMap)) {
    try {
      const info = await tokenSummaryDao.getInfoByAddressAsync(address);
      if (!info) continue;
      tokenSummaryMap[`${address}`] = info;
      let totalSupply = await getMaxTotalSupply(address, infoMap[address].abi);
      if (totalSupply !== 0) {
        tokenSummaryMap[`${address}`].max_total_supply = totalSupply;
      }
    } catch (e) {
      Logger.log(`Error in get token summary by address: ${address}. Error:`, e.message);
    }
  }
  Logger.log('tokenSummaryMap:', tokenSummaryMap);

  // Collect balance changes and store in holderMap
  /* holderMap = {
    ${contract_address}: {
      // TNT-20
      TNT20: {
        ${account_address}: balance_change,
        ...
      }
      // TNT-721
      ${tokenId}: {
        ${account_address}: balance_change,
        ...
      },
      ...
    },
    ... 
  }*/
  const holderMap = {};
  for (let token of tokenArr) {
    // If no tokenSummary info means it's not verified, handled in verify function later
    if (!tokenSummaryMap[`${token.contract_address}`] || token.type === 'unknown') {
      continue;
    }
    // Handle verified token
    if (!holderMap[`${token.contract_address}`]) {
      holderMap[`${token.contract_address}`] = {};
    }
    let holders = holderMap[`${token.contract_address}`];
    let from = token.from.toLowerCase();
    let to = token.to.toLowerCase();
    const key = token.token_id != null ? token.token_id : 'TNT20';
    let value = token.value || 1;
    if (from !== ZeroAddress) {
      if (holders[key] === undefined) {
        holders[key] = { [from]: new BigNumber(0).minus(value).toFixed(0) }
      } else if (holders[key][from] === undefined) {
        holders[key][from] = new BigNumber(0).minus(value).toFixed(0);
      } else {
        holders[key][from] = new BigNumber(holders[key][from]).minus(value).toFixed(0);
      }
    }
    if (to !== ZeroAddress) {
      if (holders[key] === undefined) {
        holders[key] = { [to]: new BigNumber(value).toFixed(0) }
      } else if (holders[key][to] === undefined) {
        holders[key][to] = new BigNumber(value).toFixed(0);
      } else {
        holders[key][to] = new BigNumber(holders[key][to]).plus(value).toFixed(0);
      }
    }
    tokenSummaryMap[`${token.contract_address}`].total_transfers++;
  }
  const updateAsyncList = [];
  for (let address of Object.keys(holderMap)) {
    const holders = holderMap[`${address}`];
    for (let key of Object.keys(holders)) {
      const map = holders[`${key}`];
      const tokenId = key === 'TNT20' ? null : key;
      let holderList = Object.keys(map);
      const newHolderList = new Set(holderList);
      const removeList = [];  // contains zero balance holders
      let list = await tokenHolderDao.getInfoByAddressAndHolderListAsync(address, tokenId, holderList);
      // Handle all holders which has a record, update or remove
      list.forEach(info => {
        const newAmount = BigNumber.sum(new BigNumber(info.amount), new BigNumber(map[`${info.holder}`]));
        if (newAmount.eq(0)) {
          removeList.push(info.holder);
        } else {
          Logger.log('update holder info:', { ...info, amount: newAmount.toFixed(0) })
          updateAsyncList.push(tokenHolderDao.upsertAsync({ ...info, amount: newAmount.toFixed(0) }))
        }
        newHolderList.delete(info.holder);
      });
      // Insert new holders 
      [...newHolderList].forEach(account => {
        updateAsyncList.push(tokenHolderDao.insertAsync({
          contract_address: address,
          holder: account,
          amount: map[`${account}`],
          token_id: tokenId
        }))
      })
      // Remove zero balance holders in removeList
      updateAsyncList.push(tokenHolderDao.removeRecordByAdressAndHolderListAsync(address, tokenId, removeList));
      // Update token summary holders
      if (key === 'TNT20') {
        tokenSummaryMap[address].holders.total += newHolderList.size - removeList.length;
      } else {
        if (tokenSummaryMap[address].holders[tokenId] === undefined) {
          tokenSummaryMap[address].holders[tokenId] = 0;
        }
        if (Number.isNaN(tokenSummaryMap[address].holders[tokenId])) {
          tokenSummaryMap[address].holders[tokenId] = 1;
        }
        tokenSummaryMap[address].holders[tokenId] += newHolderList.size - removeList.length;
      }
    }
    updateAsyncList.push(tokenSummaryDao.upsertAsync({ ...tokenSummaryMap[address] }));
  }
  await Promise.all(updateAsyncList);
  const updateHoldersList = [];
  // Update tokenSummary.total for TNT-721 tokens
  for (let address of Object.keys(tokenSummaryMap)) {
    if (tokenSummaryMap[`${address}`].type !== 'TNT-721') {
      continue;
    }
    try {
      const holderList = await tokenHolderDao.getHolderListAsync(address, null);
      let holderSet = new Set(holderList.map(info => info.holder));
      tokenSummaryMap[`${address}`].holders.total = holderSet.size;
      updateHoldersList.push(tokenSummaryDao.upsertAsync({ ...tokenSummaryMap[`${address}`] }))
    } catch (e) {
      Logger.log('Error in update tokenSummary.total for TNT-721 tokens. Error:', e.message);
    }
  }
  return Promise.all(updateHoldersList);
}

function _getContractAddressSet(tx) {
  let logs = get(tx, 'receipt.Logs');
  if (!logs) return [];
  let set = new Set();
  logs.forEach(log => {
    if (get(log, 'topics[0]') === EventHashMap.TRANSFER) {
      const address = get(log, 'address');
      if (address !== undefined && address !== ZeroAddress) {
        set.add(get(log, 'address'))
      }
    }
  })
  return [...set];
}

function _getContractAddressSetByTxs(txs) {
  let set = new Set();
  for (let tx of txs) {
    let logs = get(tx, 'receipt.Logs');
    if (!logs) continue;
    logs.forEach(log => {
      if (get(log, 'topics[0]') === EventHashMap.TRANSFER
        || get(log, 'topics[0]') === EventHashMap.TFUEL_VOUCHER_MINTED || get(log, 'topics[0]') === EventHashMap.TFUEL_VOUCHER_BURNED
        || get(log, 'topics[0]') === EventHashMap.TFUEL_TOKEN_LOCKED || get(log, 'topics[0]') === EventHashMap.TFUEL_TOKEN_UNLOCKED
        || get(log, 'topics[0]') === EventHashMap.TNT20_VOUCHER_MINTED || get(log, 'topics[0]') === EventHashMap.TNT20_VOUCHER_BURNED
        || get(log, 'topics[0]') === EventHashMap.TNT20_TOKEN_LOCKED || get(log, 'topics[0]') === EventHashMap.TNT20_TOKEN_UNLOCKED
        || get(log, 'topics[0]') === EventHashMap.TNT721_VOUCHER_MINTED || get(log, 'topics[0]') === EventHashMap.TNT721_VOUCHER_BURNED
        || get(log, 'topics[0]') === EventHashMap.TNT721_TOKEN_LOCKED || get(log, 'topics[0]') === EventHashMap.TNT721_TOKEN_UNLOCKED
        || get(log, 'topics[0]') === EventHashMap.TNT1155_VOUCHER_MINTED || get(log, 'topics[0]') === EventHashMap.TNT1155_VOUCHER_BURNED
        || get(log, 'topics[0]') === EventHashMap.TNT1155_TOKEN_LOCKED || get(log, 'topics[0]') === EventHashMap.TNT1155_TOKEN_UNLOCKED) {
        const address = get(log, 'address');
        if (address !== undefined && address !== ZeroAddress) {
          set.add(get(log, 'address'))
        }
      }
    })
  }
  return [...set];
}

function decodeLogByAbiHash(log, abiHash) {
  const events = CommonEventABIs[abiHash];
  for (let event of events) {
    try {
      const ifaceTmp = new ethers.utils.Interface([event] || []);
      let bigNumberData = ifaceTmp.decodeEventLog(event.name, log.data, log.topics);
      let data = {};
      Object.keys(bigNumberData).forEach(k => {
        data[k] = bigNumberData[k].toString();
      })
      log.decode = {
        result: data,
        eventName: event.name,
        event: event
      }
      break;
    } catch (e) {
      continue;
    }
  }
  return log;
}

async function getMaxTotalSupply(address, abi) {
  const arr = abi.filter(obj => obj.name == "totalSupply" && obj.type === 'function');
  if (arr.length === 0) return 0;
  const functionData = arr[0];
  const inputValues = []

  const iface = new ethers.utils.Interface(abi || []);
  const senderSequence = 1;
  const functionInputs = get(functionData, ['inputs'], []);
  const functionOutputs = get(functionData, ['outputs'], []);
  const functionSignature = iface.getSighash(functionData.name)

  const inputTypes = map(functionInputs, ({ name, type }) => {
    return type;
  });
  try {
    var abiCoder = new ethers.utils.AbiCoder();
    var encodedParameters = abiCoder.encode(inputTypes, inputValues).slice(2);;
    const gasPrice = Theta.getTransactionFee(); //feeInTFuelWei;
    const gasLimit = 2000000;
    const data = functionSignature + encodedParameters;
    const tx = Theta.unsignedSmartContractTx({
      from: address,
      to: address,
      data: data,
      value: 0,
      transactionFee: gasPrice,
      gasLimit: gasLimit
    }, senderSequence);
    const rawTxBytes = ThetaJS.TxSigner.serializeTx(tx);
    const callResponse = await smartContractApi.callSmartContract({ data: rawTxBytes.toString('hex').slice(2) });
    const result = get(callResponse, 'data.result');
    let outputValues = get(result, 'vm_return');
    const outputTypes = map(functionOutputs, ({ name, type }) => {
      return type;
    });
    outputValues = /^0x/i.test(outputValues) ? outputValues : '0x' + outputValues;
    let max = abiCoder.decode(outputTypes, outputValues)[0];
    return max.toString();
  } catch (e) {
    Logger.log('error occurs:', e.message);
    return 0;
  }
}
exports.updateTokenHistoryBySmartContract = async function (sc, transactionDao, accountTxDao, tokenDao, tokenSummaryDao, tokenHolderDao) {
  const abi = sc.abi;
  if (!abi) {
    return;
  }

  const isTnt721 = checkTnt721(abi);
  const isTnt20 = checkTnt20(abi);
  if (!isTnt721 && !isTnt20) {
    return;
  }
  const address = sc.address;
  const tokenType = isTnt721 ? 'TNT-721' : 'TNT-20';
  let tokenName = ""
  try {
    tokenName = await _getTNT20Name(address, abi);
  } catch (e) {
    console.log('Error in fetch token name by name function in updateTokenHistoryBySmartContract: ', e.message);
  }
  console.log('tokenName after name function:', tokenName);
  if (tokenName === "" && isTnt721) {
    try {
      tokenName = await _getTNT721Name(address, abi);
    } catch (e) {
      console.log('Error in fetch TNT-721 token name by tokenURI in updateTokenHistoryBySmartContract: ', e.message);
    }
    console.log('tokenName after tokenURI function:', tokenName);
  }
  try {
    const type = 7, isEqualType = 'true', pageNum = 0, limitNumber = 0, reverse = false;
    const txList = await accountTxDao.getListAsync(address, type, isEqualType, pageNum, limitNumber, reverse);
    let txHashes = txList.map(tx => tx.hash);
    const tokenList = await tokenDao.getInfoListByAddressAndTokenIdAsync(address, null, pageNum, limitNumber);
    let tokenTxSet = new Set(tokenList.map(info => info.hash));
    txHashes = txHashes.concat([...tokenTxSet]);
    const txs = await transactionDao.getTransactionsByPkAsync(txHashes);
    const tokenArr = [];
    const insertList = [];
    for (let tx of txs) {
      let logs = get(tx, 'receipt.Logs');
      logs = JSON.parse(JSON.stringify(logs));
      logs = logs.map(obj => {
        obj.data = getHex(obj.data)
        return obj;
      })
      logs = decodeLogs(logs, abi);
      for (let [i, log] of logs.entries()) {
        if (get(log, 'topics[0]') !== EventHashMap.TRANSFER) {
          continue;
        }
        const contractAddress = get(log, 'address');
        // If log.address !== sc.address, it will be handled in verification of contract log.address
        if (contractAddress !== address) {
          continue;
        }
        const id = tx.hash + i;
        const tokenId = get(log, 'decode.result.tokenId');
        const value = tokenId != null ? 1 : get(log, 'decode.result[2]');
        const newToken = {
          hash: tx.hash.toLowerCase(),
          from: get(log, 'decode.result[0]').toLowerCase(),
          to: get(log, 'decode.result[1]').toLowerCase(),
          token_id: tokenId,
          value,
          name: tokenName,
          type: tokenType,
          timestamp: tx.timestamp,
          contract_address: contractAddress
        }
        tokenArr.push(newToken);
        insertList.push(tokenDao.upsertAsync(id, newToken))
      }
    }
    await updateTokenSummary(tokenArr, address, tokenName, tokenType, abi, tokenSummaryDao, tokenHolderDao);
    return Promise.all(insertList);
  } catch (e) {
    console.log('Something wrong happened during the updateTokenHistoryByAddress process:', e)
  }

}

function checkTnt721(abi) {
  const obj = {
    'balanceOf': { contains: false, type: 'function' },
    'ownerOf': { contains: false, type: 'function' },
    'safeTransferFrom': { contains: false, type: 'function' },
    'transferFrom': { contains: false, type: 'function' },
    'approve': { contains: false, type: 'function' },
    'setApprovalForAll': { contains: false, type: 'function' },
    'getApproved': { contains: false, type: 'function' },
    'isApprovedForAll': { contains: false, type: 'function' },
    'Transfer': { contains: false, type: 'event' },
    'Approval': { contains: false, type: 'event' },
    'ApprovalForAll': { contains: false, type: 'event' },
  }

  return _check(obj, abi);
}

function checkTnt20(abi) {
  const obj = {
    'name': { contains: false, type: 'function' },
    'symbol': { contains: false, type: 'function' },
    'decimals': { contains: false, type: 'function' },
    'totalSupply': { contains: false, type: 'function' },
    'balanceOf': { contains: false, type: 'function' },
    'transfer': { contains: false, type: 'function' },
    'transferFrom': { contains: false, type: 'function' },
    'approve': { contains: false, type: 'function' },
    'allowance': { contains: false, type: 'function' },
    'Transfer': { contains: false, type: 'event' },
    'Approval': { contains: false, type: 'event' },
  }

  return _check(obj, abi);
}

function _check(obj, abi) {
  abi.forEach(o => {
    if (obj[o.name] !== undefined) {
      if (obj[o.name].type === o.type) {
        obj[o.name].contains = true
      }
    }
  })
  let res = true;
  for (let key in obj) {
    res = res && obj[key].contains
  }
  return res;
}

function decodeLogs(logs, abi) {
  const iface = new ethers.utils.Interface(abi || []);
  return logs.map(log => {
    try {
      let event = null;
      for (let i = 0; i < abi.length; i++) {
        let item = abi[i];
        if (item.type != "event") continue;
        const hash = iface.getEventTopic(item.name)
        if (hash == log.topics[0]) {
          event = item;
          break;
        }
      }
      if (event != null) {
        let bigNumberData = iface.decodeEventLog(event.name, log.data, log.topics);
        let data = {};
        Object.keys(bigNumberData).forEach(k => {
          data[k] = bigNumberData[k].toString();
        })
        log.decode = {
          result: data,
          eventName: event.name,
          event: event
        }
      } else {
        log.decode = 'No matched event or the smart contract source code has not been verified.';
      }
      return log;
    } catch (e) {
      log.decode = 'Something wrong while decoding, met error: ' + e;
      return log;
    }
  })
}
async function _getTNT20Name(address, abi) {
  const arr = abi.filter(obj => obj.name == "name" && obj.type === 'function');
  if (arr.length === 0) return "";
  const functionData = arr[0];
  const inputValues = []

  const iface = new ethers.utils.Interface(abi || []);
  const senderSequence = 1;
  const functionInputs = get(functionData, ['inputs'], []);
  const functionOutputs = get(functionData, ['outputs'], []);
  const functionSignature = iface.getSighash(functionData.name)

  const inputTypes = map(functionInputs, ({ name, type }) => {
    return type;
  });
  try {
    var abiCoder = new ethers.utils.AbiCoder();
    var encodedParameters = abiCoder.encode(inputTypes, inputValues).slice(2);;
    const gasPrice = Theta.getTransactionFee(); //feeInTFuelWei;
    const gasLimit = 2000000;
    const data = functionSignature + encodedParameters;
    const tx = Theta.unsignedSmartContractTx({
      from: address,
      to: address,
      data: data,
      value: 0,
      transactionFee: gasPrice,
      gasLimit: gasLimit
    }, senderSequence);
    const rawTxBytes = ThetaJS.TxSigner.serializeTx(tx);
    const callResponse = await smartContractApi.callSmartContract({ data: rawTxBytes.toString('hex').slice(2) });
    const result = get(callResponse, 'data.result');
    let outputValues = get(result, 'vm_return');
    const outputTypes = map(functionOutputs, ({ name, type }) => {
      return type;
    });
    outputValues = /^0x/i.test(outputValues) ? outputValues : '0x' + outputValues;
    let url = abiCoder.decode(outputTypes, outputValues)[0];
    return url;
  } catch (e) {
    console.log('error occurs:', e.message);
    return "";
  }
}

async function _getTNT721Name(address, abi) {
  const arr = abi.filter(obj => obj.name == "contractURI" && obj.type === 'function');
  if (arr.length === 0) return "";
  const functionData = arr[0];
  const inputValues = []

  const iface = new ethers.utils.Interface(abi || []);
  const senderSequence = 1;
  const functionInputs = get(functionData, ['inputs'], []);
  const functionOutputs = get(functionData, ['outputs'], []);
  const functionSignature = iface.getSighash(functionData.name)

  const inputTypes = map(functionInputs, ({ name, type }) => {
    return type;
  });
  try {
    var abiCoder = new ethers.utils.AbiCoder();
    var encodedParameters = abiCoder.encode(inputTypes, inputValues).slice(2);;
    const gasPrice = Theta.getTransactionFee(); //feeInTFuelWei;
    const gasLimit = 2000000;
    const data = functionSignature + encodedParameters;
    const tx = Theta.unsignedSmartContractTx({
      from: address,
      to: address,
      data: data,
      value: 0,
      transactionFee: gasPrice,
      gasLimit: gasLimit
    }, senderSequence);
    const rawTxBytes = ThetaJS.TxSigner.serializeTx(tx);
    const callResponse = await smartContractApi.callSmartContract({ data: rawTxBytes.toString('hex').slice(2) });
    const result = get(callResponse, 'data.result');
    let outputValues = get(result, 'vm_return');
    const outputTypes = map(functionOutputs, ({ name, type }) => {
      return type;
    });
    outputValues = /^0x/i.test(outputValues) ? outputValues : '0x' + outputValues;
    let url = abiCoder.decode(outputTypes, outputValues)[0];
    if (/^http:\/\/(.*)api.thetadrop.com.*\.json(\?[-a-zA-Z0-9@:%._\\+~#&//=]*){0,1}$/g.test(url) && typeof url === "string") {
      url = url.replace("http://", "https://")
    }
    const isImage = /(http(s?):)([/|.|\w|\s|-])*\.(?:jpg|gif|png|svg)/g.test(url);
    if (isImage) {
      return "";
    } else {
      return axios.get(url)
        .then(res => {
          let name = get(res, 'data.name');
          return name || "";
        }).catch(e => {
          console.log('error occurs in fetch url:', e.message)
          return "";
        })
    }
  } catch (e) {
    console.log('error occurs:', e.message);
    return "";
  }
}

async function updateTokenSummary(tokenArr, address, tokenName, tokenType, abi, tokenSummaryDao, tokenHolderDao) {
  console.log('In updateTokenSummary')
  const tokenInfo = {
    _id: address,
    holders: { total: 0 },
    max_total_supply: 0,
    total_transfers: 0,
    name: tokenName,
    type: tokenType
  };
  try {
    tokenInfo.max_total_supply = await _getMaxTotalSupply(address, abi);
    if (tokenType === 'TNT-20') {
      tokenInfo.decimals = await getDecimals(address, abi);
      tokenInfo.symbol = await getSymbol(address, abi);
    }
  } catch (e) {
    console.log('Error met when get max total supply and decimals in updateTokenSummary: ', e.message);
  }
  // Collect balance changes and store in holderMap
  /* holderMap = {
      // TNT-20
      TNT20: {
        ${account_address}: balance_change,
        ...
      }
      // TNT-721
      ${tokenId}: {
        ${account_address}: balance_change,
        ...
      },
      ...
  }*/
  const holders = {};
  for (let token of tokenArr) {
    let from = token.from.toLowerCase();
    let to = token.to.toLowerCase();
    const key = token.token_id != null ? token.token_id : 'TNT20';
    let value = token.value || 1;
    if (from !== ZeroAddress) {
      if (holders[key] === undefined) {
        holders[key] = { [from]: new BigNumber(0).minus(value).toFixed(0) }
      } else if (holders[key][from] === undefined) {
        holders[key][from] = new BigNumber(0).minus(value).toFixed(0);
      } else {
        holders[key][from] = new BigNumber(holders[key][from]).minus(value).toFixed(0);
      }
      if (holders[key][from] == 0) delete holders[key][from];
      if (Object.keys(holders[key]).length == 0) delete holders[key];
    }
    if (to !== ZeroAddress) {
      if (holders[key] === undefined) {
        holders[key] = { [to]: new BigNumber(value).toFixed(0) }
      } else if (holders[key][to] === undefined) {
        holders[key][to] = new BigNumber(value).toFixed(0);
      } else {
        holders[key][to] = new BigNumber(holders[key][to]).plus(value).toFixed(0);
      }
      if (holders[key][to] == 0) delete holders[key][to];
      if (Object.keys(holders[key]).length == 0) delete holders[key];
    }
    tokenInfo.total_transfers++;
  }
  const updateAsyncList = [];
  const totalHolderSet = new Set();
  for (let key of Object.keys(holders)) {
    const map = holders[`${key}`];
    const tokenId = key === 'TNT20' ? null : key;
    let newHolderList = Object.keys(map);

    newHolderList.forEach(account => {
      totalHolderSet.add(account);
      updateAsyncList.push(tokenHolderDao.insertAsync({
        contract_address: address,
        holder: account,
        amount: map[`${account}`],
        token_id: tokenId
      }))
    })
    // Update token summary holders
    if (key === 'TNT20') {
      tokenInfo.holders.total = newHolderList.length;
    } else {
      tokenInfo.holders[`${tokenId}`] = newHolderList.length;
    }
  }
  if (tokenType === 'TNT-721') {
    tokenInfo.holders.total = totalHolderSet.size;
  }
  updateAsyncList.push(tokenSummaryDao.upsertAsync({ ...tokenInfo }));
  return Promise.all(updateAsyncList);
}


async function _getMaxTotalSupply(address, abi) {
  const arr = abi.filter(obj => obj.name == "totalSupply" && obj.type === 'function');
  if (arr.length === 0) return 0;
  const functionData = arr[0];
  const inputValues = []

  const iface = new ethers.utils.Interface(abi || []);
  const senderSequence = 1;
  const functionInputs = get(functionData, ['inputs'], []);
  const functionOutputs = get(functionData, ['outputs'], []);
  const functionSignature = iface.getSighash(functionData.name)

  const inputTypes = map(functionInputs, ({ name, type }) => {
    return type;
  });
  try {
    var abiCoder = new ethers.utils.AbiCoder();
    var encodedParameters = abiCoder.encode(inputTypes, inputValues).slice(2);;
    const gasPrice = Theta.getTransactionFee(); //feeInTFuelWei;
    const gasLimit = 2000000;
    const data = functionSignature + encodedParameters;
    const tx = Theta.unsignedSmartContractTx({
      from: address,
      to: address,
      data: data,
      value: 0,
      transactionFee: gasPrice,
      gasLimit: gasLimit
    }, senderSequence);
    const rawTxBytes = ThetaJS.TxSigner.serializeTx(tx);
    const callResponse = await smartContractApi.callSmartContract({ data: rawTxBytes.toString('hex').slice(2) });
    const result = get(callResponse, 'data.result');
    let outputValues = get(result, 'vm_return');
    const outputTypes = map(functionOutputs, ({ name, type }) => {
      return type;
    });
    outputValues = /^0x/i.test(outputValues) ? outputValues : '0x' + outputValues;
    let max = abiCoder.decode(outputTypes, outputValues)[0];
    return max.toString();
  } catch (e) {
    console.log('error occurs:', e.message);
    return 0;
  }
}

async function getDecimals(address, abi) {
  const arr = abi.filter(obj => obj.name == "decimals" && obj.type === 'function');
  if (arr.length === 0) return 0;
  const functionData = arr[0];
  const inputValues = []

  const iface = new ethers.utils.Interface(abi || []);
  const senderSequence = 1;
  const functionInputs = get(functionData, ['inputs'], []);
  const functionOutputs = get(functionData, ['outputs'], []);
  const functionSignature = iface.getSighash(functionData.name)

  const inputTypes = map(functionInputs, ({ name, type }) => {
    return type;
  });
  try {
    var abiCoder = new ethers.utils.AbiCoder();
    var encodedParameters = abiCoder.encode(inputTypes, inputValues).slice(2);;
    const gasPrice = Theta.getTransactionFee(); //feeInTFuelWei;
    const gasLimit = 2000000;
    const data = functionSignature + encodedParameters;
    const tx = Theta.unsignedSmartContractTx({
      from: address,
      to: address,
      data: data,
      value: 0,
      transactionFee: gasPrice,
      gasLimit: gasLimit
    }, senderSequence);
    const rawTxBytes = ThetaJS.TxSigner.serializeTx(tx);
    const callResponse = await smartContractApi.callSmartContract({ data: rawTxBytes.toString('hex').slice(2) });
    const result = get(callResponse, 'data.result');
    let outputValues = get(result, 'vm_return');
    const outputTypes = map(functionOutputs, ({ name, type }) => {
      return type;
    });
    outputValues = /^0x/i.test(outputValues) ? outputValues : '0x' + outputValues;
    let decimals = abiCoder.decode(outputTypes, outputValues)[0];
    return decimals.toString();
  } catch (e) {
    console.log('error occurs:', e.message);
    return 0;
  }
}

async function getSymbol(address, abi) {
  const arr = abi.filter(obj => obj.name == "symbol" && obj.type === 'function');
  if (arr.length === 0) return "";
  const functionData = arr[0];
  const inputValues = []

  const iface = new ethers.utils.Interface(abi || []);
  const senderSequence = 1;
  const functionInputs = get(functionData, ['inputs'], []);
  const functionOutputs = get(functionData, ['outputs'], []);
  const functionSignature = iface.getSighash(functionData.name)

  const inputTypes = map(functionInputs, ({ name, type }) => {
    return type;
  });
  try {
    var abiCoder = new ethers.utils.AbiCoder();
    var encodedParameters = abiCoder.encode(inputTypes, inputValues).slice(2);;
    const gasPrice = Theta.getTransactionFee(); //feeInTFuelWei;
    const gasLimit = 2000000;
    const data = functionSignature + encodedParameters;
    const tx = Theta.unsignedSmartContractTx({
      from: address,
      to: address,
      data: data,
      value: 0,
      transactionFee: gasPrice,
      gasLimit: gasLimit
    }, senderSequence);
    const rawTxBytes = ThetaJS.TxSigner.serializeTx(tx);
    const callResponse = await smartContractApi.callSmartContract({ data: rawTxBytes.toString('hex').slice(2) });
    const result = get(callResponse, 'data.result');
    let outputValues = get(result, 'vm_return');
    const outputTypes = map(functionOutputs, ({ name, type }) => {
      return type;
    });
    outputValues = /^0x/i.test(outputValues) ? outputValues : '0x' + outputValues;
    let symbol = abiCoder.decode(outputTypes, outputValues)[0];
    return symbol;
  } catch (e) {
    console.log('error occurs:', e.message);
    return "";
  }
}

exports.getMaxSupply = async function (address, abi) {
  const arr = abi.filter(obj => obj.name == "maxSupply" && obj.type === 'function');
  if (arr.length === 0) return 0;
  const functionData = arr[0];
  const inputValues = []

  const iface = new ethers.utils.Interface(abi || []);
  const senderSequence = 1;
  const functionInputs = get(functionData, ['inputs'], []);
  const functionOutputs = get(functionData, ['outputs'], []);
  const functionSignature = iface.getSighash(functionData.name)

  const inputTypes = map(functionInputs, ({ name, type }) => {
    return type;
  });
  try {
    var abiCoder = new ethers.utils.AbiCoder();
    var encodedParameters = abiCoder.encode(inputTypes, inputValues).slice(2);;
    const gasPrice = Theta.getTransactionFee(); //feeInTFuelWei;
    const gasLimit = 2000000;
    const data = functionSignature + encodedParameters;
    const tx = Theta.unsignedSmartContractTx({
      from: address,
      to: address,
      data: data,
      value: 0,
      transactionFee: gasPrice,
      gasLimit: gasLimit
    }, senderSequence);
    const rawTxBytes = ThetaJS.TxSigner.serializeTx(tx);
    const callResponse = await smartContractApi.callSmartContract({ data: rawTxBytes.toString('hex').slice(2) });
    const result = get(callResponse, 'data.result');
    let outputValues = get(result, 'vm_return');
    const outputTypes = map(functionOutputs, ({ name, type }) => {
      return type;
    });
    outputValues = /^0x/i.test(outputValues) ? outputValues : '0x' + outputValues;
    let max = abiCoder.decode(outputTypes, outputValues)[0];
    return max.toString();
  } catch (e) {
    console.log('error occurs:', e.message);
    return 0;
  }
}

exports.getMaxTotalSupply = _getMaxTotalSupply;