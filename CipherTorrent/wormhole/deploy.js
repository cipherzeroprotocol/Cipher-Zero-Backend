const { initializeWormhole } = require("./client");

async function deployWormhole() {
    const { wormhole, wallet } = await initializeWormhole();

    // Example: Initiate a cross-chain transfer
    const receipt = await wormhole.send(wallet, "DESTINATION_CHAIN", "TOKEN_ADDRESS", "AMOUNT");

    console.log("Wormhole Transfer initiated:", receipt);
}

deployWormhole().catch(console.error);
