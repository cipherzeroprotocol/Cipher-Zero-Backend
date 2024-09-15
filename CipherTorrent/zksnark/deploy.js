const { generateProof } = require("./client");

async function deployZkSNARK() {
    const input = { /* Your input data */ };
    const wasmFile = "path/to/your/circuit.wasm";
    const zkeyFile = "path/to/your/circuit_final.zkey";

    const { proof, publicSignals } = await generateProof(input, wasmFile, zkeyFile);

    console.log("zkSNARK Proof generated:", proof);
    console.log("Public Signals:", publicSignals);
}

deployZkSNARK().catch(console.error);
