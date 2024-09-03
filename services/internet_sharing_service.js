// services/internet_sharing_service.js

const { ethers } = require("ethers");

// Replace with your contract ABI and address
const internetSharingAbi = [
    // Add the ABI of your InternetSharing contract here
];
const internetSharingAddress = "0xYourInternetSharingContractAddress";

// Set up provider and signer
const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID");
const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
const contract = new ethers.Contract(internetSharingAddress, internetSharingAbi, wallet);

async function shareInternet(recipient, amount) {
    const tx = await contract.shareInternet(recipient, ethers.utils.parseUnits(amount, 18));
    console.log("Transaction Hash:", tx.hash);
    await tx.wait();
    console.log("Internet Shared Successfully");
}

async function getSharedInternet(recipient) {
    const amount = await contract.getSharedInternet(recipient);
    console.log("Internet Shared Amount:", ethers.utils.formatUnits(amount, 18));
}

async function main() {
    const recipient = "0xRecipientAddress";
    const amount = "10"; // Amount in units

    await shareInternet(recipient, amount);
    await getSharedInternet(recipient);
}

main().catch(console.error);
