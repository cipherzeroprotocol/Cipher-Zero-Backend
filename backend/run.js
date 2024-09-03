const { MongoClient } = require('mongodb');
const config = require('config');

const mongoUri = config.get('MONGO.URI');
const dbName = config.get('MONGO.DB_NAME');

const SDK = require('sdk'); // Adjust the path according to your project setup
const sdkInstance = new SDK();
async function getContractData() {
  const data = await sdkInstance.getContractData('contractAddress');
  return data;
}
MongoClient.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(client => {
    const db = client.db(dbName);
    // Initialize other services, such as BitTorrent, smart contracts, etc.
  })
  .catch(err => {
    console.error(err);
  });
