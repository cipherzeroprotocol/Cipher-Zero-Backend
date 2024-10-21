const Web3 = require('web3'); // Web3 for Ethereum interaction
const ContractABI = require('./abis/YourContractABI.json'); // Import the contract ABI
const { CONTRACT_ADDRESS } = require('../config/default.json'); // Contract address from configuration
const logger = require('../utils/logger'); // Logger for tracking interactions

// Initialize Web3 instance with your provider (e.g., Infura, Alchemy, etc.)
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_PROVIDER_URL));

// Function to send a transaction to a smart contract
const sendTransaction = async (method, params, senderAddress) => {
  try {
    const contract = new web3.eth.Contract(ContractABI, CONTRACT_ADDRESS);
    const gasEstimate = await contract.methods[method](...params).estimateGas({ from: senderAddress });

    const transaction = {
      from: senderAddress,
      to: CONTRACT_ADDRESS,
      gas: gasEstimate,
      data: contract.methods[method](...params).encodeABI(),
    };

    const signedTx = await web3.eth.accounts.signTransaction(transaction, process.env.PRIVATE_KEY); // Sign the transaction
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction); // Send the transaction

    logger.info(`Transaction successful: ${receipt.transactionHash}`); // Log the transaction hash
    return receipt; // Return the transaction receipt
  } catch (error) {
    logger.error(`Transaction failed: ${error.message}`); // Log any errors
    throw new Error('Transaction failed.'); // Throw an error for further handling
  }
};

// Function to fetch data from a contract
const fetchData = async (method, params) => {
  try {
    const contract = new web3.eth.Contract(ContractABI, CONTRACT_ADDRESS);
    const data = await contract.methods[method](...params).call(); // Call contract method
    return data; // Return the fetched data
  } catch (error) {
    logger.error(`Failed to fetch data: ${error.message}`); // Log any errors
    throw new Error('Data fetching failed.'); // Throw an error for further handling
  }
};

module.exports = {
  sendTransaction,
  fetchData,
};
