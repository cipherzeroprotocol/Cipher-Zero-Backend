const { ethers } = require('ethers');
const config = require('config');
const contractABI = require('./contracts/BitThetaSecure.json');

const provider = new ethers.providers.JsonRpcProvider(config.get('SMART_CONTRACT.THETA_NETWORK_URL'));
const wallet = new ethers.Wallet(config.get('SMART_CONTRACT.PRIVATE_KEY'), provider);
const contractAddress = config.get('SMART_CONTRACT.CONTRACT_ADDRESS');
const contract = new ethers.Contract(contractAddress, contractABI, wallet);
const SDK = require('sdk'); // Adjust the path according to your project setup
const sdkInstance = new SDK();
async function getContractData() {
  const data = await sdkInstance.getContractData('contractAddress');
  return data;
}
async function getContractData() {
  try {
    const data = await contract.someMethod();
    console.log('Contract data:', data);
  } catch (error) {
    console.error('Error fetching contract data:', error);
  }
}

module.exports = {
  getContractData,
};
