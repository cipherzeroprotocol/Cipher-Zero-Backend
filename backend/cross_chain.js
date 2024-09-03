import Web3 from 'web3';
import { CrossChainContractABI } from './abis/cross_chain_contract.json'; // Adjust the path as needed

const web3 = new Web3(Web3.givenProvider || 'http://localhost:8545');
const crossChainContractAddress = '0xYourCrossChainContractAddress';
const crossChainContract = new web3.eth.Contract(CrossChainContractABI, crossChainContractAddress);

export const transferAssets = async (fromAddress, toAddress, amount, chainId) => {
    try {
        const receipt = await crossChainContract.methods.transferAssets(toAddress, amount, chainId).send({ from: fromAddress });
        console.log('Assets transferred:', receipt);
        return receipt;
    } catch (error) {
        console.error('Error transferring assets:', error);
        throw error;
    }
};

export const getTransferStatus = async (transactionId) => {
    try {
        const status = await crossChainContract.methods.getTransferStatus(transactionId).call();
        console.log('Transfer status:', status);
        return status;
    } catch (error) {
        console.error('Error getting transfer status:', error);
        throw error;
    }
};
