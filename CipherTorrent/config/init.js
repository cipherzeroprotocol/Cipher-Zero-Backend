const { initializeZkSync } = require("../zksync/client");
const { initializeWormhole } = require("../wormhole/client");
const zkSnarkClient = require("../zksnark/client");

async function initServices() {
    const zkSyncWallet = await initializeZkSync();
    const wormholeClient = await initializeWormhole();
    const zkSnarkService = zkSnarkClient;

    return {
        zkSyncWallet,
        wormholeClient,
        zkSnarkService,
    };
}

module.exports = { initServices };
