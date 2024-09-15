var BigNumber = require('bignumber.js');
var WEI = 1000000000000000000;
var { linkBytecode } = require('solc/linker');
var fs = require('fs');
var path = require('path');
const crypto = require('crypto');
var BigNumber = require('bignumber.js');
var bluebird = require("bluebird");
var { createIndex } = require('../../mongo-db/mongo-client.js');

exports.sumCoin = function (weiAmountA, weiAmountB) {
    return BigNumber.sum(new BigNumber(weiAmountA), new BigNumber(weiAmountB))
}
exports.timeCoin = function (amountA, amountB) {
    return new BigNumber(amountA).times(amountB);
}
exports.createIndexes = async function () {
    const createIndexAsync = bluebird.promisify(_createIndex);
    await createIndexAsync('block', { timestamp: -1 })

    await createIndexAsync('transaction', { number: 1 })
    await createIndexAsync('transaction', { timestamp: -1 })
    await createIndexAsync('transaction', { status: 1, number: 1 })
    await createIndexAsync('transaction', { eth_tx_hash: 1 })

    await createIndexAsync('acctTx', { acct: 1, hash: 1 })
    await createIndexAsync('acctTx', { acct: 1, ts: 1 })
    await createIndexAsync('acctTx', { acct: 1, type: 1, ts: 1 })

    await createIndexAsync('account', { "balance.thetawei": -1 })
    await createIndexAsync('account', { "balance.tfuelwei": -1 })

    await createIndexAsync('stake', { type: 1, holder: 1 })
    await createIndexAsync('stake', { type: 1, source: 1 })

    await createIndexAsync('accounting', { addr: 1, date: 1 })

    await createIndexAsync('checkpoint', { height: -1 })

    await createIndexAsync('activeAct', { timestamp: -1 })

    await createIndexAsync('totalAct', { timestamp: -1 })

    await createIndexAsync('token', { contract_address: 1, timestamp: -1 })
    await createIndexAsync('token', { contract_address: 1, tokenId: 1, timestamp: -1 })
    await createIndexAsync('token', { contract_address: 1, type: 1 })
    await createIndexAsync('token', { from: 1, type: 1, timestamp: -1 })
    await createIndexAsync('token', { to: 1, type: 1, timestamp: -1 })

    await createIndexAsync('tokenHolder', { contract_address: 1, token_id: 1, holder: 1 })
    await createIndexAsync('tokenHolder', { contract_address: 1, token_id: 1, amount: 1 })
    await createIndexAsync('tokenHolder', { contract_address: 1, holder: 1 })
}

function _createIndex(collectionName, object, callback) {
    createIndex(collectionName, object, callback);
}

exports.getHex = function (str) {
    const buffer = Buffer.from(str, 'base64');
    const bufString = buffer.toString('hex');
    return '0x' + bufString;
}
exports.normalize = function (hash) {
    const regex = /^0x/i;
    return regex.test(hash) ? hash : '0x' + hash;
}

exports.getBytecodeWithoutMetadata = function (bytecode) {
    // Last 4 chars of bytecode specify byte size of metadata component,
    const metadataSize = parseInt(bytecode.slice(-4), 16) * 2 + 4;
    const metadataStarts = bytecode.slice(bytecode.length - metadataSize, bytecode.length - metadataSize + 14)
    const endPoint = bytecode.indexOf(metadataStarts)
    return bytecode.slice(0, endPoint);
}

exports.getHex = function (str) {
    const buffer = Buffer.from(str, 'base64');
    const bufString = buffer.toString('hex');
    return '0x' + bufString;
}
exports.stampDate = function (sourceCode) {
    let date = new Date();
    const offset = date.getTimezoneOffset()
    date = new Date(date.getTime() - (offset * 60 * 1000))
    return `/**\n *Submitted for verification at thetatoken.org on ${date.toISOString().split('T')[0]}\n */\n` + sourceCode;
}
exports.flatSourceCode = function (sourceCode) {
    const flattenedBytecode = Object.values(sourceCode).map(contract => contract.content).join('\n');
    let flattenedSource = linkBytecode(flattenedBytecode, {});
    flattenedSource = flattenedSource.replace(/import.*;\n/g, "");

    const solidityPragmaRegex = /pragma solidity.*\n/g;

    flattenedSource = flattenedSource.replace(solidityPragmaRegex, (match, offset) => {
        return offset === flattenedSource.search(solidityPragmaRegex) ? match : "";
    });
    return flattenedSource;
}

exports.convertToHashString = function (inputString) {
    const hash = crypto.createHash('sha256').update(inputString).digest('hex');
    return hash.substr(0, 32);
}


function _getImportedContracts(importedFiles, input) {
    let nestedImportedContracts = [];

    for (const importedFile of importedFiles) {
        const importedSource = fs.readFileSync(`node_modules/${importedFile}`, 'utf8');

        const nestedImports = importedSource.match(/import\s+"(.+\.sol)"/g) || [];
        console.log('nestedImports:', nestedImports)
        input.sources[importedFile] = {
            content: importedSource
        };
        if (nestedImports.length > 0) {
            const nestedImportedFiles = [...new Set(nestedImports.map((match) => path.join(path.dirname(importedFile), match.replace(/import\s+"/g, '').replace(/"/g, ''))))];
            console.log('nestedImportedFiles:', nestedImportedFiles)
            nestedImportedContracts.push(..._getImportedContracts(nestedImportedFiles, input));
        }
    }

    return nestedImportedContracts;
}

exports.getImportedContracts = _getImportedContracts;

exports.isVersionLater = function (version, target) {
    const versionParts = version.split('.').map(Number);
    const targetParts = target.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        if (versionParts[i] > targetParts[i]) {
            return true;
        } else if (versionParts[i] < targetParts[i]) {
            return false;
        }
    }

    return true;
}
exports.normalize = function (hash) {
    const regex = /^0x/i;
    return regex.test(hash) ? hash : '0x' + hash;
}

exports.sumCoin = function (weiAmountA, weiAmountB) {
    return BigNumber.sum(new BigNumber(weiAmountA), new BigNumber(weiAmountB))
}

exports.formatCoin = function (weiAmount) {
    return new BigNumber(weiAmount).dividedBy(WEI);
}

exports.validateHex = function (hash, limit = 64) {
    const reg = new RegExp("^(0x){0,1}[0-9a-f]{" + limit + "}$");
    return reg.test(hash);
}

exports.getHex = function (str) {
    const buffer = Buffer.from(str, 'base64');
    const bufString = buffer.toString('hex');
    return '0x' + bufString;
}

exports.getTokenAddress = function (token) {
    const tokenAddressMap = {
        'tdrop': '0x1336739b05c7ab8a526d40dcc0d04a826b5f8b03',
        'lavita': '0x46fbf4487fa1b9c70d35bd761c51c360df9459ed'
    }
    return tokenAddressMap[token];
}