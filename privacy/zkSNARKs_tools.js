// privacy/zkSNARKs_tools.js

const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

/**
 * Generate a zkSNARK proof.
 * @param {string} circuitPath - Path to the circuit file.
 * @param {Object} inputs - The inputs for the circuit.
 * @param {string} provingKeyPath - Path to the proving key file.
 * @return {Promise<string>} - The proof in JSON format.
 */
async function generateProof(circuitPath, inputs, provingKeyPath) {
    const circuit = fs.readFileSync(path.resolve(circuitPath), 'utf8');
    const provingKey = fs.readFileSync(path.resolve(provingKeyPath), 'utf8');
    
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuit, inputs, provingKey);
    return JSON.stringify(proof);
}

/**
 * Verify a zkSNARK proof.
 * @param {string} proof - The proof to verify.
 * @param {string} publicSignals - The public signals used for verification.
 * @param {string} verificationKeyPath - Path to the verification key file.
 * @return {Promise<boolean>} - True if the proof is valid, false otherwise.
 */
async function verifyProof(proof, publicSignals, verificationKeyPath) {
    const verificationKey = fs.readFileSync(path.resolve(verificationKeyPath), 'utf8');
    
    const result = await snarkjs.groth16.verify(verificationKey, publicSignals, JSON.parse(proof));
    return result;
}

module.exports = {
    generateProof,
    verifyProof
};
