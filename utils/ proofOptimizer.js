const { Worker } = require('worker_threads');
const logger = require('../../utils/logger');

class ProofOptimizer {
    constructor(options = {}) {
        this.options = {
            maxWorkers: options.maxWorkers || 4,
            maxBatchSize: options.maxBatchSize || 1000,
            timeoutMs: options.timeoutMs || 30000,
            ...options
        };

        this.workers = new Map();
        this.perfStats = new Map();
    }

    /**
     * Optimize proof generation using parallel processing
     */
    async optimizeProofGeneration(inputs, circuitType) {
        try {
            // Monitor performance
            const startTime = performance.now();

            // Split inputs into optimal batches
            const batches = this.splitIntoBatches(inputs);

            // Process batches in parallel
            const results = await Promise.all(
                batches.map(batch => 
                    this.processBatchWithWorker(batch, circuitType)
                )
            );

            // Record performance stats
            this.recordPerformance(circuitType, performance.now() - startTime);

            return this.combineResults(results);

        } catch (error) {
            logger.error('Proof optimization failed:', error);
            throw error;
        }
    }

    /**
     * Process batch with worker thread
     */
    async processBatchWithWorker(batch, circuitType) {
        return new Promise((resolve, reject) => {
            const worker = new Worker('./proofWorker.js', {
                workerData: {
                    batch,
                    circuitType,
                    options: this.options
                }
            });

            const timeout = setTimeout(() => {
                worker.terminate();
                reject(new Error('Proof generation timeout'));
            }, this.options.timeoutMs);

            worker.on('message', (result) => {
                clearTimeout(timeout);
                resolve(result);
            });

            worker.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }

    /**
     * Split inputs into optimal batches
     */
    splitIntoBatches(inputs) {
        const batchSize = this.calculateOptimalBatchSize(inputs.length);
        const batches = [];

        for (let i = 0; i < inputs.length; i += batchSize) {
            batches.push(inputs.slice(i, i + batchSize));
        }

        return batches;
    }

    /**
     * Calculate optimal batch size based on input size and system resources
     */
    calculateOptimalBatchSize(inputSize) {
        const { maxBatchSize } = this.options;
        
        if (inputSize <= maxBatchSize) return inputSize;

        // Calculate based on system memory and CPU
        const availableMemory = process.memoryUsage().heapTotal;
        const optimalSize = Math.floor(availableMemory / (1024 * 1024 * 100)); // 100MB per batch

        return Math.min(optimalSize, maxBatchSize);
    }

    /**
     * Record performance statistics
     */
    recordPerformance(circuitType, duration) {
        const stats = this.perfStats.get(circuitType) || {
            count: 0,
            totalTime: 0,
            averageTime: 0
        };

        stats.count++;
        stats.totalTime += duration;
        stats.averageTime = stats.totalTime / stats.count;

        this.perfStats.set(circuitType, stats);
    }

    /**
     * Get performance statistics
     */
    getPerformanceStats() {
        return Object.fromEntries(this.perfStats);
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        for (const worker of this.workers.values()) {
            await worker.terminate();
        }
        this.workers.clear();
    }
}

module.exports = {
    ProofAggregator,
    ProofOptimizer
};