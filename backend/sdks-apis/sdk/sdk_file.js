// sdk/example_sdk.js

import Web3 from 'web3';

const web3 = new Web3(Web3.givenProvider || 'http://localhost:8545');

export const getNetworkId = async () => {
    try {
        const networkId = await web3.eth.net.getId();
        console.log('Network ID:', networkId);
        return networkId;
    } catch (error) {
        console.error('Error getting network ID:', error);
        throw error;
    }
};

export const deployContract = async (contractABI, contractBytecode, deployerAddress, ...constructorArgs) => {
    try {
        const contract = new web3.eth.Contract(contractABI);
        const deployedContract = await contract.deploy({
            data: contractBytecode,
            arguments: constructorArgs,
        }).send({ from: deployerAddress, gas: '3000000' });

        console.log('Contract deployed at address:', deployedContract.options.address);
        return deployedContract;
    } catch (error) {
        console.error('Error deploying contract:', error);
        throw error;
    }
};
