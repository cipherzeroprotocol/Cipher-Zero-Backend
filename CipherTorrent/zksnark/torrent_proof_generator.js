const snarkjs = require('snarkjs');
const crypto = require('crypto');

class TorrentProofGenerator {
    constructor(circuitWasmFile, zkeyFile) {
        this.circuitWasmFile = circuitWasmFile;
        this.zkeyFile = zkeyFile;
    }

    async generateTorrentProof(torrentData, privateData) {
        const input = this.prepareTorrentInput(torrentData, privateData);
        return await this.generateProof(input);
    }

    async generatePieceProof(pieceData, pieceIndex, privateData) {
        const input = this.preparePieceInput(pieceData, pieceIndex, privateData);
        return await this.generateProof(input);
    }

    async generateHavePiecesProof(piecesBitfield, privateData) {
        const input = this.prepareHavePiecesInput(piecesBitfield, privateData);
        return await this.generateProof(input);
    }

    async generateCompleteFileProof(fileHash, privateData) {
        const input = this.prepareCompleteFileInput(fileHash, privateData);
        return await this.generateProof(input);
    }

    async generateProof(input) {
        try {
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input, 
                this.circuitWasmFile, 
                this.zkeyFile
            );

            return { proof, publicSignals };
        } catch (error) {
            console.error("Error generating proof:", error);
            throw new Error("Failed to generate proof");
        }
    }

    prepareTorrentInput(torrentData, privateData) {
        // Hash the torrent data to create a public commitment
        const commitment = this.generateCommitment(torrentData);

        return {
            torrentDataHash: commitment,
            privateData: privateData
        };
    }

    preparePieceInput(pieceData, pieceIndex, privateData) {
        const pieceHash = this.generateCommitment(pieceData);

        return {
            pieceHash: pieceHash,
            pieceIndex: pieceIndex,
            privateData: privateData
        };
    }

    prepareHavePiecesInput(piecesBitfield, privateData) {
        const bitfieldHash = this.generateCommitment(piecesBitfield);

        return {
            bitfieldHash: bitfieldHash,
            privateData: privateData
        };
    }

    prepareCompleteFileInput(fileHash, privateData) {
        return {
            fileHash: fileHash,
            privateData: privateData
        };
    }

    generateCommitment(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }
}

module.exports = TorrentProofGenerator;