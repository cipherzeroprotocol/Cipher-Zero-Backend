const snarkjs = require('snarkjs');
const fs = require('fs').promises;
const path = require('path');

class ProofVerifier {
    constructor(circuitName) {
        this.circuitName = circuitName;
        this.vKeyPath = path.join(__dirname, `../build/${circuitName}.vkey.json`);
    }

    async verifyProof(proof, publicSignals) {
        try {
            const vKey = await this.loadVerificationKey();
            const result = await snarkjs.groth16.verify(vKey, publicSignals, proof);
            
            return result;
        } catch (error) {
            console.error(`Error verifying proof for ${this.circuitName}:`, error);
            throw new Error(`Proof verification failed: ${error.message}`);
        }
    }

    async loadVerificationKey() {
        try {
            const vKeyJson = await fs.readFile(this.vKeyPath, 'utf-8');
            return JSON.parse(vKeyJson);
        } catch (error) {
            console.error(`Error loading verification key for ${this.circuitName}:`, error);
            throw new Error(`Failed to load verification key: ${error.message}`);
        }
    }
}

module.exports = ProofVerifier;