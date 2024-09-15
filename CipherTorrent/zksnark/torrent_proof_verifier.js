const snarkjs = require('snarkjs');
const crypto = require('crypto');

class TorrentProofVerifier {
    constructor(vkeyFile) {
        this.vkeyFile = vkeyFile;
    }

    async verifyTorrentProof(proof, publicSignals, expectedCommitment) {
        return this.verifyProof(proof, publicSignals, expectedCommitment);
    }

    async verifyPieceProof(proof, publicSignals, expectedPieceHash, expectedPieceIndex) {
        if (publicSignals[1] !== expectedPieceIndex.toString()) {
            return false;
        }
        return this.verifyProof(proof, publicSignals, expectedPieceHash);
    }

    async verifyHavePiecesProof(proof, publicSignals, expectedBitfieldHash) {
        return this.verifyProof(proof, publicSignals, expectedBitfieldHash);
    }

    async verifyCompleteFileProof(proof, publicSignals, expectedFileHash) {
        return this.verifyProof(proof, publicSignals, expectedFileHash);
    }

    async verifyProof(proof, publicSignals, expectedCommitment) {
        try {
            // Load verification key
            const vkey = await this.loadVerificationKey();

            // Verify the proof
            const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);

            // Check if the commitment in public signals matches the expected commitment
            const commitmentMatches = publicSignals[0] === expectedCommitment;

            return verified && commitmentMatches;
        } catch (error) {
            console.error("Error verifying proof:", error);
            return false;
        }
    }

    async loadVerificationKey() {
        try {
            return await snarkjs.zKey.exportVerificationKey(this.vkeyFile);
        } catch (error) {
            console.error("Error loading verification key:", error);
            throw new Error("Failed to load verification key");
        }
    }

    generateCommitment(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }
}

module.exports = TorrentProofVerifier;