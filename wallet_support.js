import Web3 from 'web3';

// Configure Web3 with the appropriate provider for your multi-chain wallet
const web3 = new Web3(Web3.givenProvider || 'http://localhost:8545');

export const getWalletBalance = async (address) => {
    try {
        const balance = await web3.eth.getBalance(address);
        console.log('Wallet balance:', web3.utils.fromWei(balance, 'ether'));
        return web3.utils.fromWei(balance, 'ether');
    } catch (error) {
        console.error('Error getting wallet balance:', error);
        throw error;
    }
};

export const sendTransaction = async (fromAddress, toAddress, amount) => {
    try {
        const receipt = await web3.eth.sendTransaction({
            from: fromAddress,
            to: toAddress,
            value: web3.utils.toWei(amount, 'ether'),
        });
        console.log('Transaction sent:', receipt);
        return receipt;
    } catch (error) {
        console.error('Error sending transaction:', error);
        throw error;
    }
};
