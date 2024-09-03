// services/price_oracle_service.js

const { ethers } = require("ethers");

// Replace with your contract ABI and address
const priceOracleAbi = [
    // Add the ABI of your PriceOracle contract here
];
const priceOracleAddress = "0xYourPriceOracleContractAddress";

// Set up provider
const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID");
const contract = new ethers.Contract(priceOracleAddress, priceOracleAbi, provider);

async function getPrice(assetAddress) {
    const price = await contract.getPrice(assetAddress);
    console.log("Current Price:", ethers.utils.formatUnits(price, 18));
}

async function main() {
    const assetAddress = "0xAssetAddress"; // Replace with the asset address you want to check

    await getPrice(assetAddress);
}

main().catch(console.error);
