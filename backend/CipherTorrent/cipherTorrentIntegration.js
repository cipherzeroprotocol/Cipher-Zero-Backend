const BitTorrentClient = require('./lib/client');
const fs = require('fs');
const path = require('path');

async function uploadFile(filePath) {
  const client = new BitTorrentClient();
  const fileBuffer = fs.readFileSync(filePath);
  const torrent = await client.seed(fileBuffer);
  console.log('File uploaded:', torrent.infoHash);
}

async function downloadFile(infoHash, downloadPath) {
  const client = new BitTorrentClient();
  client.add(infoHash, (torrent) => {
    torrent.files.forEach(file => {
      file.getBuffer((err, buffer) => {
        if (err) throw err;
        fs.writeFileSync(path.resolve(downloadPath, file.name), buffer);
        console.log('File downloaded:', file.name);
      });
    });
  });
}

const filePath = path.resolve(__dirname, 'path_to_file_to_upload');
uploadFile(filePath);
