const { initializeZkSync } = require("./client");

async function deployZkSync() {
    const wallet = await initializeZkSync();

    // Example: Deploy a zkSync smart contract
    const factory = new ethers.ContractFactory("YOUR_CONTRACT_ABI", "YOUR_CONTRACT_BYTECODE", wallet);
    const contract = await factory.deploy();

    console.log("zkSync Contract deployed at:", contract.address);
}

deployZkSync().catch(console.error);
