// services/dePIN_service.js

const { ethers } = require("ethers");

// Replace with your dePIN contract ABI and address
const dePINAbi = [
    // Add the ABI of your dePIN contract here
];
const dePINAddress = "0xYourDePINContractAddress";

// Set up provider and signer
const provider = new ethers.providers.JsonRpcProvider("https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID");
const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
const contract = new ethers.Contract(dePINAddress, dePINAbi, wallet);

async function registerNode(nodeId, nodeData) {
    const tx = await contract.registerNode(nodeId, nodeData);
    console.log("Transaction Hash:", tx.hash);
    await tx.wait();
    console.log("Node Registered Successfully");
}

async function getNodeData(nodeId) {
    const data = await contract.getNodeData(nodeId);
    console.log("Node Data:", data);
}

async function main() {
    const nodeId = "1"; // Replace with your node ID
    const nodeData = "Node details"; // Replace with your node data

    await registerNode(nodeId, nodeData);
    await getNodeData(nodeId);
}

main().catch(console.error);
