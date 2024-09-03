const mongoose = require('mongoose');
const { ethers } = require('ethers');
const config = require('config');
const SDK = require('sdk'); // Adjust the path according to your project setup
const sdkInstance = new SDK();

const connectDB = async () => {
  const mongoUri = config.get('MONGO.URI');
  try {
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected...');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

const connectSmartContract = () => {
  const provider = new ethers.providers.JsonRpcProvider(config.get('SMART_CONTRACT.THETA_NETWORK_URL'));
  const wallet = new ethers.Wallet(config.get('SMART_CONTRACT.PRIVATE_KEY'), provider);
  const contractAddress = config.get('SMART_CONTRACT.CONTRACT_ADDRESS');
  const contract = new ethers.Contract(contractAddress, contractABI, wallet);
  return contract;
};

module.exports = {
  connectDB,
  connectSmartContract,
};
