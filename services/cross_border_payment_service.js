// services/cross_border_payment_service.js

const { ethers } = require("ethers");

// Replace with your cross-border payment contract ABI and address
const crossBorderPaymentAbi = [
    // Add the ABI of your Cross-Border Payment contract here
];
const crossBorderPaymentAddress = "0xYourCrossBorderPaymentContractAddress";

// Set up provider and signer
const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID");
const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
const contract = new ethers.Contract(crossBorderPaymentAddress, crossBorderPaymentAbi, wallet);

async function initiatePayment(amount, fromCurrency, toCurrency, recipientAddress) {
    const tx = await contract.initiatePayment(amount, fromCurrency, toCurrency, recipientAddress);
    console.log("Transaction Hash:", tx.hash);
    await tx.wait();
    console.log("Payment Initiated Successfully");
}

async function getPaymentStatus(paymentId) {
    const status = await contract.getPaymentStatus(paymentId);
    console.log("Payment Status:", status);
}

async function main() {
    const amount = "1000"; // Amount to transfer
    const fromCurrency = "USD"; // Currency code of sender
    const toCurrency = "EUR"; // Currency code of recipient
    const recipientAddress = "0xRecipientAddress"; // Replace with recipient address

    await initiatePayment(amount, fromCurrency, toCurrency, recipientAddress);
    await getPaymentStatus("1"); // Replace with your payment ID
}

main().catch(console.error);
