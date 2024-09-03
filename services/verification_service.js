// services/verification_service.js

const { ethers } = require("ethers");

// Replace with your contract ABI and address
const verificationAbi = [
    // Add the ABI of your Verification contract here
];
const verificationAddress = "0xYourVerificationContractAddress";

// Set up provider and signer
const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID");
const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
const contract = new ethers.Contract(verificationAddress, verificationAbi, wallet);

async function verifyAsset(assetId) {
    const tx = await contract.verifyAsset(assetId);
    console.log("Transaction Hash:", tx.hash);
    await tx.wait();
    console.log("Asset Verified Successfully");
}

async function checkVerificationStatus(assetId) {
    const status = await contract.checkVerificationStatus(assetId);
    console.log("Verification Status:", status ? "Verified" : "Not Verified");
}

async function main() {
    const assetId = "12345"; // Replace with your asset ID

    await verifyAsset(assetId);
    await checkVerificationStatus(assetId);
}

main().catch(console.error);
