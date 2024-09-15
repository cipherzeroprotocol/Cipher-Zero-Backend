const snarkjs = require("snarkjs");

async function generateProof(input, wasmFile, zkeyFile) {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmFile, zkeyFile);
    return { proof, publicSignals };
}

module.exports = { generateProof };
