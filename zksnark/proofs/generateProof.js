const snarkjs = require('snarkjs');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { MerkleTree } = require('merkletreejs');
const SHA256 = require('crypto-js/sha256');

class ProofGenerator {
    constructor(circuitName) {
        this.circuitName = circuitName;
        this.wasmPath = path.join(__dirname, `../build/${circuitName}.wasm`);
        this.zkeyPath = path.join(__dirname, `../build/${circuitName}.zkey`);
    }

    async generateProof(inputs) {
        try {
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, this.wasmPath, this.zkeyPath);
            
            return {
                proof: this.formatProof(proof),
                publicSignals: publicSignals.map(BigInt)
            };
        } catch (error) {
            console.error(`Error generating proof for ${this.circuitName}:`, error);
            throw new Error(`Proof generation failed: ${error.message}`);
        }
    }

    formatProof(proof) {
        return {
            pi_a: proof.pi_a.map(BigInt),
            pi_b: proof.pi_b.map(arr => arr.map(BigInt)),
            pi_c: proof.pi_c.map(BigInt),
        };
    }

    async generateInputs(data) {
        // This method should be overridden for each specific circuit
        throw new Error('generateInputs method must be implemented for each circuit');
    }
}

class IPHidingProofGenerator extends ProofGenerator {
    constructor() {
        super('ipHiding');
    }

    async generateInputs(ip, networkPrefix) {
        const ipOctets = ip.split('.').map(Number);
        const salt = crypto.randomBytes(32).toString('hex');
        const obfuscatedIPHash = await this.hashIP(ipOctets, salt);

        return {
            ip: ipOctets,
            salt: BigInt(`0x${salt}`),
            networkPrefix: BigInt(networkPrefix),
            obfuscatedIPHash: BigInt(obfuscatedIPHash)
        };
    }

    async hashIP(ipOctets, salt) {
        const input = [...ipOctets, salt].map(BigInt);
        const hashedIP = await snarkjs.poseidon(input);
        return hashedIP.toString();
    }
}

class FileSharingProofGenerator extends ProofGenerator {
    constructor() {
        super('fileSharing');
        this.FILE_CHUNK_SIZE = 256; // in bytes
    }

    async generateInputs(file, recipientPublicKey) {
        const fileChunks = await this.chunkFile(file);
        const salt = crypto.randomBytes(32);
        const { merkleRoot, merkleProof, merkleProofIndex } = await this.generateMerkleProof(fileChunks);
        const fileHashCommitment = await this.generateFileHashCommitment(fileChunks, salt);
        const accessKeyHash = await this.generateAccessKeyHash(recipientPublicKey);

        return {
            fileChunks: fileChunks.map(chunk => BigInt(`0x${chunk.toString('hex')}`)),
            fileSalt: BigInt(`0x${salt.toString('hex')}`),
            merkleRoot: BigInt(`0x${merkleRoot}`),
            merkleProof: merkleProof.map(proof => BigInt(`0x${proof}`)),
            merkleProofIndex: BigInt(merkleProofIndex),
            fileHashCommitment: BigInt(`0x${fileHashCommitment}`),
            recipientPublicKey: BigInt(recipientPublicKey),
            accessKeyHash: BigInt(`0x${accessKeyHash}`)
        };
    }

    async chunkFile(filePath) {
        const fileBuffer = await fs.readFile(filePath);
        const chunks = [];
        for (let i = 0; i < fileBuffer.length; i += this.FILE_CHUNK_SIZE) {
            chunks.push(fileBuffer.slice(i, i + this.FILE_CHUNK_SIZE));
        }
        // Pad the last chunk if necessary
        if (chunks[chunks.length - 1].length < this.FILE_CHUNK_SIZE) {
            const lastChunk = chunks[chunks.length - 1];
            const paddedChunk = Buffer.alloc(this.FILE_CHUNK_SIZE);
            lastChunk.copy(paddedChunk);
            chunks[chunks.length - 1] = paddedChunk;
        }
        return chunks;
    }

    async generateMerkleProof(fileChunks) {
        const leaves = fileChunks.map(chunk => SHA256(chunk));
        const tree = new MerkleTree(leaves, SHA256);
        const root = tree.getRoot().toString('hex');
        const leaf = leaves[0];
        const proof = tree.getProof(leaf);
        const proofHex = proof.map(p => p.data.toString('hex'));
        return {
            merkleRoot: root,
            merkleProof: proofHex,
            merkleProofIndex: 0 // We're using the first leaf for simplicity
        };
    }

    async generateFileHashCommitment(fileChunks, salt) {
        const concatenatedChunks = Buffer.concat(fileChunks);
        const commitment = crypto.createHash('sha256')
            .update(concatenatedChunks)
            .update(salt)
            .digest('hex');
        return commitment;
    }

    async generateAccessKeyHash(recipientPublicKey) {
        const accessKey = crypto.randomBytes(32);
        const accessKeyHash = crypto.createHash('sha256')
            .update(accessKey)
            .update(recipientPublicKey.toString())
            .digest('hex');
        return accessKeyHash;
    }
}

module.exports = {
    IPHidingProofGenerator,
    FileSharingProofGenerator
};