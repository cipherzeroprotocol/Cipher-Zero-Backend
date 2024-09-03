'use strict';
const { initServices } = require("./lib/config/init");
const download = require('./src/download');
const torrentParser = require('./src/torrent-parser');

const torrent = torrentParser.open(process.argv[2]);
async function main() {
    const services = await initServices();
    const { zkSyncWallet, wormholeClient, zkSnarkService } = services;

    // Example usage of zkSync
    async function deployWithZkSync() {
        // Deployment logic using zkSyncWallet
        console.log("zkSync Wallet initialized:", zkSyncWallet.address);
    }

    // Example usage of Wormhole
    async function deployWithWormhole() {
        // Deployment logic using wormholeClient
        console.log("Wormhole Client initialized:", wormholeClient.wormhole);
    }

    // Example usage of zkSNARK
    async function deployWithZkSnark() {
        const input = { /* Your input data */ };
        const wasmFile = "path/to/your/circuit.wasm";
        const zkeyFile = "path/to/your/circuit_final.zkey";

        const { proof, publicSignals } = await zkSnarkService.generateProof(input, wasmFile, zkeyFile);

        console.log("zkSNARK Proof generated:", proof);
        console.log("Public Signals:", publicSignals);
    }

    await deployWithZkSync();
    await deployWithWormhole();
    await deployWithZkSnark();
}

main().catch(console.error);



download(torrent, torrent.info.name);