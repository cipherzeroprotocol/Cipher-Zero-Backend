const { BitTorrentClient } = require('bittorrent');

const uploadToBitTorrent = async (file) => {
  const client = new BitTorrentClient();
  const torrent = await client.seed(file);
  return torrent.magnetURI;
};

module.exports = {
  uploadToBitTorrent,
};
