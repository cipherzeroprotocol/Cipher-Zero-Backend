// proofAggregator.js
const { poseidon } = require('circomlib');
const snarkjs = require('snarkjs');
const logger = require('../../utils/logger');

class ProofAggregator {
    constructor() {
        this.proofCache = new Map();
        this.recursiveLevel = 0;
        this.MAX_RECURSIVE_DEPTH = 3; // Maximum recursive aggregation depth
    }

    /**
     * Aggregate multiple proofs into a single proof
     */
    async aggregateProofs(proofs, circuitType) {
        try {
            const cacheKey = this.generateCacheKey(proofs);
            
            // Check cache first
            if (this.proofCache.has(cacheKey)) {
                return this.proofCache.get(cacheKey);
            }

            // Group proofs based on type and optimize aggregation
            const groupedProofs = this.groupProofsByType(proofs);
            
            // Aggregate proofs recursively with batching
            const aggregatedProof = await this.recursiveAggregate(
                groupedProofs[circuitType],
                circuitType
            );

            // Cache the result
            this.proofCache.set(cacheKey, aggregatedProof);
            
            return aggregatedProof;

        } catch (error) {
            logger.error('Proof aggregation failed:', error);
            throw error;
        }
    }

    /**
     * Recursively aggregate proofs with batching
     */
    async recursiveAggregate(proofs, circuitType) {
        if (this.recursiveLevel >= this.MAX_RECURSIVE_DEPTH) {
            throw new Error('Maximum recursive depth reached');
        }

        try {
            this.recursiveLevel++;

            // Batch proofs into optimal groups
            const batchSize = this.calculateOptimalBatchSize(proofs.length);
            const batches = this.batchProofs(proofs, batchSize);

            // Aggregate each batch
            const aggregatedBatches = await Promise.all(
                batches.map(batch => this.aggregateBatch(batch, circuitType))
            );

            // If we have multiple batches, recurse
            if (aggregatedBatches.length > 1) {
                return await this.recursiveAggregate(aggregatedBatches, circuitType);
            }

            this.recursiveLevel--;
            return aggregatedBatches[0];

        } catch (error) {
            this.recursiveLevel--;
            throw error;
        }
    }

    /**
     * Aggregate a single batch of proofs
     */
    async aggregateBatch(proofs, circuitType) {
        const aggregationInputs = {
            proofs: proofs.map(p => p.proof),
            publicSignals: proofs.map(p => p.publicSignals)
        };

        // Select appropriate aggregation circuit based on type
        const { wasmFile, zkeyFile } = this.getAggregationCircuit(circuitType);

        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            aggregationInputs,
            wasmFile,
            zkeyFile
        );

        return { proof, publicSignals };
    }

    /**
     * Calculate optimal batch size based on proof count
     */
    calculateOptimalBatchSize(proofCount) {
        // Optimize batch size based on proof count and system capabilities
        if (proofCount <= 4) return proofCount;
        if (proofCount <= 16) return 4;
        return 8; // Default optimal batch size
    }

    /**
     * Group proofs by their circuit type
     */
    groupProofsByType(proofs) {
        return proofs.reduce((groups, proof) => {
            const type = proof.circuitType;
            groups[type] = groups[type] || [];
            groups[type].push(proof);
            return groups;
        }, {});
    }

    /**
     * Get appropriate aggregation circuit based on type
     */
    getAggregationCircuit(circuitType) {
        const circuits = {
            message: {
                wasmFile: './circuits/messageAggregation.wasm',
                zkeyFile: './circuits/messageAggregation.zkey'
            },
            token: {
                wasmFile: './circuits/tokenAggregation.wasm',
                zkeyFile: './circuits/tokenAggregation.zkey'
            }
        };

        return circuits[circuitType];
    }

    /**
     * Generate cache key for proof set
     */
    generateCacheKey(proofs) {
        return poseidon(
            proofs.map(p => BigInt(p.proof[0]))
        ).toString();
    }
}
