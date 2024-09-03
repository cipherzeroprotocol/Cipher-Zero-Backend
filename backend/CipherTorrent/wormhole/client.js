const { ethers } = require("ethers");
const Wormhole = require("@certusone/wormhole-sdk");

async function initializeWormhole() {
    const provider = new ethers.providers.JsonRpcProvider("YOUR_RPC_URL");
    const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
    const wormhole = new Wormhole.Wormhole();

    return { wormhole, wallet };
}

module.exports = { initializeWormhole };
