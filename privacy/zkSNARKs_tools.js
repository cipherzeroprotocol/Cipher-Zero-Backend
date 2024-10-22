const snarkjs = require('snarkjs');
const fs = require('fs').promises; // Using promises for better async handling
const path = require('path');
const { performance } = require('perf_hooks');
const crypto = require('crypto');

class ZkSNARKsTools {
    constructor() {
        // Cache for proving and verification keys
        this.keyCache = new Map();
        // Cache for circuit files
        this.circuitCache = new Map();
        // Cache for proof results
        this.proofCache = new Map();
    }

    /**
     * Generate a hash for caching
     * @private
     */
    _generateHash(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    /**
     * Load and cache a file
     * @private
     */
    async _loadAndCacheFile(filePath, cacheMap) {
        if (cacheMap.has(filePath)) {
            return cacheMap.get(filePath);
        }

        try {
            const fileContent = await fs.readFile(path.resolve(filePath), 'utf8');
            cacheMap.set(filePath, fileContent);
            return fileContent;
        } catch (error) {
            throw new Error(`Failed to load file ${filePath}: ${error.message}`);
        }
    }

    /**
     * Generate a zkSNARK proof with performance monitoring and caching
     * @param {string} circuitPath - Path to the circuit file
     * @param {Object} inputs - The inputs for the circuit
     * @param {string} provingKeyPath - Path to the proving key file
     * @param {Object} options - Additional options (e.g., useCache, timeoutMs)
     * @return {Promise<Object>} - Object containing proof, publicSignals, and performance metrics
     */
    async generateProof(circuitPath, inputs, provingKeyPath, options = {}) {
        const startTime = performance.now();
        const inputHash = this._generateHash(inputs);

        try {
            // Check cache if enabled
            if (options.useCache && this.proofCache.has(inputHash)) {
                return {
                    ...this.proofCache.get(inputHash),
                    fromCache: true,
                    generationTime: 0
                };
            }

            // Load circuit and proving key with timeout
            const [circuit, provingKey] = await Promise.all([
                this._loadAndCacheFile(circuitPath, this.circuitCache),
                this._loadAndCacheFile(provingKeyPath, this.keyCache)
            ]);

            // Generate proof with timeout
            const { proof, publicSignals } = await Promise.race([
                snarkjs.groth16.fullProve(circuit, inputs, provingKey),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Proof generation timeout')), 
                    options.timeoutMs || 30000)
                )
            ]);

            const result = {
                proof: JSON.stringify(proof),
                publicSignals,
                generationTime: performance.now() - startTime,
                fromCache: false
            };

            // Cache the result if caching is enabled
            if (options.useCache) {
                this.proofCache.set(inputHash, result);
            }

            return result;

        } catch (error) {
            throw new Error(`Proof generation failed: ${error.message}`);
        }
    }

    /**
     * Verify a zkSNARK proof with performance monitoring
     * @param {string} proof - The proof to verify
     * @param {string} publicSignals - The public signals
     * @param {string} verificationKeyPath - Path to the verification key file
     * @param {Object} options - Additional options (e.g., timeoutMs)
     * @return {Promise<Object>} - Object containing verification result and performance metrics
     */
    async verifyProof(proof, publicSignals, verificationKeyPath, options = {}) {
        const startTime = performance.now();

        try {
            const verificationKey = await this._loadAndCacheFile(
                verificationKeyPath, 
                this.keyCache
            );

            // Verify proof with timeout
            const isValid = await Promise.race([
                snarkjs.groth16.verify(
                    verificationKey, 
                    publicSignals, 
                    JSON.parse(proof)
                ),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Verification timeout')), 
                    options.timeoutMs || 10000)
                )
            ]);

            return {
                isValid,
                verificationTime: performance.now() - startTime
            };

        } catch (error) {
            throw new Error(`Proof verification failed: ${error.message}`);
        }
    }

    /**
     * Clear all caches
     */
    clearCaches() {
        this.keyCache.clear();
        this.circuitCache.clear();
        this.proofCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            keyCacheSize: this.keyCache.size,
            circuitCacheSize: this.circuitCache.size,
            proofCacheSize: this.proofCache.size
        };
    }
}

// Export singleton instance
module.exports = new ZkSNARKsTools();

// Example usage:
/*
const zkTools = require('./zkSNARKs_tools');

async function example() {
    try {
        const proofResult = await zkTools.generateProof(
            './circuits/example.circom',
            { input: 123 },
            './keys/proving_key.json',
            { useCache: true, timeoutMs: 20000 }
        );

        const verificationResult = await zkTools.verifyProof(
            proofResult.proof,
            proofResult.publicSignals,
            './keys/verification_key.json'
        );

        console.log('Proof generation time:', proofResult.generationTime, 'ms');
        console.log('Verification time:', verificationResult.verificationTime, 'ms');
        console.log('Is valid:', verificationResult.isValid);

    } catch (error) {
        console.error('Error:', error.message);
    }
}
*/