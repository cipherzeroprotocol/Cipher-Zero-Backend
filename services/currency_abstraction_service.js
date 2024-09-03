// services/currency_abstraction_service.js

const { ethers } = require("ethers");

// Replace with your currency abstraction contract ABI and address
const currencyAbstractionAbi = [
    // Add the ABI of your Currency Abstraction contract here
];
const currencyAbstractionAddress = "0xYourCurrencyAbstractionContractAddress";

// Set up provider and signer
const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID");
const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
const contract = new ethers.Contract(currencyAbstractionAddress, currencyAbstractionAbi, wallet);

async function convertCurrency(amount, fromCurrency, toCurrency) {
    const tx = await contract.convertCurrency(amount, fromCurrency, toCurrency);
    console.log("Transaction Hash:", tx.hash);
    await tx.wait();
    console.log("Currency Conversion Successful");
}

async function getConversionRate(fromCurrency, toCurrency) {
    const rate = await contract.getConversionRate(fromCurrency, toCurrency);
    console.log(`Conversion Rate from ${fromCurrency} to ${toCurrency}:`, rate);
}

async function main() {
    const amount = "500"; // Amount to convert
    const fromCurrency = "BTC"; // Cryptocurrency code
    const toCurrency = "ETH"; // Cryptocurrency code

    await convertCurrency(amount, fromCurrency, toCurrency);
    await getConversionRate(fromCurrency, toCurrency);
}

main().catch(console.error);
