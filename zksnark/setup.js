const snarkjs = require('snarkjs');
const fs = require('fs').promises;
const path = require('path');

class CircuitSetup {
    constructor(circuitName) {
        this.circuitName = circuitName;
        this.circuitPath = path.join(__dirname, `../circuits/${circuitName}.circom`);
        this.outputDir = path.join(__dirname, '../build');
    }

    async setup() {
        try {
            await this.compile();
            await this.generateZKey();
            await this.exportVerificationKey();
            console.log(`Setup completed for ${this.circuitName}`);
        } catch (error) {
            console.error(`Error during setup for ${this.circuitName}:`, error);
            throw new Error(`Setup failed: ${error.message}`);
        }
    }

    async compile() {
        console.log(`Compiling ${this.circuitName}...`);
        await snarkjs.zKey.newCircom(this.circuitPath, path.join(this.outputDir, `${this.circuitName}.wasm`));
    }

    async generateZKey() {
        console.log(`Generating zKey for ${this.circuitName}...`);
        const entropy = await this.getEntropy();
        const zkeyPath = path.join(this.outputDir, `${this.circuitName}.zkey`);
        
        await snarkjs.zKey.newZKey(
            path.join(this.outputDir, `${this.circuitName}.r1cs`),
            path.join(__dirname, '../node_modules/snarkjs/build/powersOfTau28_hez_final_14.ptau'),
            zkeyPath,
            { entropy }
        );
    }

    async exportVerificationKey() {
        console.log(`Exporting verification key for ${this.circuitName}...`);
        const zkeyPath = path.join(this.outputDir, `${this.circuitName}.zkey`);
        const vKeyPath = path.join(this.outputDir, `${this.circuitName}.vkey.json`);
        
        const vKey = await snarkjs.zKey.exportVerificationKey(zkeyPath);
        await fs.writeFile(vKeyPath, JSON.stringify(vKey, null, 2));
    }

    async getEntropy() {
        return Buffer.from(await fs.readFile('/dev/urandom', { length: 32 })).toString('hex');
    }
}

async function setupAllCircuits() {
    const circuits = ['ipHiding', 'fileSharing'];
    for (const circuit of circuits) {
        const setup = new CircuitSetup(circuit);
        await setup.setup();
    }
}

setupAllCircuits().catch(console.error);

module.exports = CircuitSetup;