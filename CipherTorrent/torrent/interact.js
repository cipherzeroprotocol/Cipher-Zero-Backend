const TorrentClient = require("./client");
const TorrentData = require("./torrentdata/index");
const { initServices } = require("../config/init");

async function interactTorrent() {
    const services = await initServices();
    const { zkSyncWallet, wormholeClient, zkSnarkService } = services;

    const client = new TorrentClient();
    const data = new TorrentData();

    // Example: Load a torrent
    const torrent = await data.loadTorrent('example-torrent-hash');

    // Example: Start downloading the torrent
    client.downloadTorrent(torrent);

    // Example: Integrate zkSync, Wormhole, or zkSNARK if needed
    // e.g., using Wormhole for cross-chain data transfer
    console.log('Started download for:', torrent.infoHash);
}

interactTorrent().catch(console.error);
