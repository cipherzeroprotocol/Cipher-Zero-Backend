// utils/privacy_tools.js

const { generateProof, verifyProof } = require('../../privacy/zkSNARKs_tools');
const { initializeMPC, performComputation, shareData } = require('../../privacy/mPC_tools');

/**
 * Generate and verify a zkSNARK proof.
 * @param {string} circuitPath - Path to the circuit file.
 * @param {Object} inputs - The inputs for the circuit.
 * @param {string} provingKeyPath - Path to the proving key file.
 * @param {string} verificationKeyPath - Path to the verification key file.
 * @return {Promise<boolean>} - True if the proof is valid, false otherwise.
 */
async function generateAndVerifyProof(circuitPath, inputs, provingKeyPath, verificationKeyPath) {
    const proof = await generateProof(circuitPath, inputs, provingKeyPath);
    const publicSignals = inputs; // Assuming inputs as public signals for simplicity
    const isValid = await verifyProof(proof, publicSignals, verificationKeyPath);
    return isValid;
}

/**
 * Initialize an MPC instance and perform a computation.
 * @param {Array<string>} parties - List of parties involved in the computation.
 * @param {Function} computationFunction - The function defining the computation.
 * @param {Object} inputs - The inputs for the computation.
 * @return {Promise<Object>} - The result of the computation.
 */
async function performMPCComputation(parties, computationFunction, inputs) {
    const mpc = initializeMPC(parties);
    const result = await performComputation(mpc, computationFunction, inputs);
    return result;
}

/**
 * Share data among parties in an MPC protocol.
 * @param {Array<string>} parties - List of parties involved in the MPC.
 * @param {Object} data - The data to be shared.
 * @return {Promise<void>} - A promise that resolves when the data is shared.
 */
async function shareMPCData(parties, data) {
    const mpc = initializeMPC(parties);
    await shareData(mpc, data);
}

module.exports = {
    generateAndVerifyProof,
    performMPCComputation,
    shareMPCData
};
