const Web3 = require('web3'); // Web3 for Ethereum interaction
const ContractABI = require('./abis/YourContractABI.json'); // Import the contract ABI
const { CONTRACT_ADDRESS } = require('../config/default.json'); // Contract address from configuration
const logger = require('../utils/logger'); // Logger for tracking events

// Initialize Web3 instance with your provider (e.g., Infura, Alchemy, etc.)
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3_WS_PROVIDER_URL));

// Function to listen for contract events
const listenToEvents = () => {
  const contract = new web3.eth.Contract(ContractABI, CONTRACT_ADDRESS);

  // Listening for a specific event (e.g., 'FileUploaded')
  contract.events.FileUploaded({
    filter: {}, // You can specify filters for indexed event parameters
    fromBlock: 'latest', // Start listening from the latest block
  })
  .on('data', (event) => {
    logger.info(`New event received: ${JSON.stringify(event)}`); // Log the event data
    // Implement your logic here, e.g., update database or notify users
  })
  .on('error', (error) => {
    logger.error(`Error listening to events: ${error.message}`); // Log any errors
  });
};

module.exports = {
  listenToEvents,
};
