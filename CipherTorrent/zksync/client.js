const zksync = require("zksync");
const ethers = require("ethers");

async function initializeZkSync() {
    const provider = new ethers.providers.JsonRpcProvider("YOUR_RPC_URL");
    const syncProvider = await zksync.getDefaultProvider("mainnet");
    const wallet = new zksync.Wallet("YOUR_PRIVATE_KEY", syncProvider, provider);

    return wallet;
}

module.exports = { initializeZkSync };
