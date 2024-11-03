// /realtime/handlers/proofHandler.js
const { EventEmitter } = require('events');
const { ProofQueue } = require('../queue/proofQueue');
const { ProofService } = require('../../services/proofService');
const logger = require('../../utils/logger');

class ProofHandler extends EventEmitter {
    constructor(io) {
        super();
        this.io = io;
        this.proofQueue = new ProofQueue();
        this.proofService = new ProofService();
        this.activeProofs = new Map();
        this.proofSubscriptions = new Map();
        this.PROOF_TYPES = {
            FILE: 'file',
            MESSAGE: 'message',
            TRANSFER: 'transfer',
            PEER: 'peer',
            BATCH: 'batch'
        };
    }

    /**
     * Initialize handler
     */
    async initialize() {
        await this.proofQueue.initialize();
        this.setupSocketHandlers();
        this.setupQueueListeners();
        logger.info('ProofHandler initialized');
    }

    /**
     * Setup socket handlers
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            // Proof generation requests
            socket.on('proof:generate', async (data) => {
                try {
                    await this.handleProofGeneration(socket, data);
                } catch (error) {
                    this.sendError(socket, 'proof:error', error);
                }
            });

            // Batch proof requests
            socket.on('proof:generate-batch', async (data) => {
                try {
                    await this.handleBatchProofGeneration(socket, data);
                } catch (error) {
                    this.sendError(socket, 'proof:error', error);
                }
            });

            // Proof verification requests
            socket.on('proof:verify', async (data) => {
                try {
                    await this.handleProofVerification(socket, data);
                } catch (error) {
                    this.sendError(socket, 'proof:error', error);
                }
            });

            // Proof status subscriptions
            socket.on('proof:subscribe', async (data) => {
                try {
                    await this.handleProofSubscription(socket, data);
                } catch (error) {
                    this.sendError(socket, 'proof:error', error);
                }
            });

            socket.on('proof:unsubscribe', (data) => {
                this.handleProofUnsubscription(socket, data);
            });

            // Clear subscriptions on disconnect
            socket.on('disconnect', () => {
                this.clearSocketSubscriptions(socket);
            });
        });
    }

    /**
     * Setup queue event listeners
     */
    setupQueueListeners() {
        this.proofQueue.on('proof:started', (data) => {
            this.updateProofStatus(data.proofId, {
                status: 'generating',
                progress: 0
            });
        });

        this.proofQueue.on('proof:progress', (data) => {
            this.updateProofStatus(data.proofId, {
                status: 'generating',
                progress: data.progress
            });
        });

        this.proofQueue.on('proof:completed', (data) => {
            this.updateProofStatus(data.proofId, {
                status: 'completed',
                proof: data.proof,
                progress: 100
            });
        });

        this.proofQueue.on('proof:failed', (data) => {
            this.updateProofStatus(data.proofId, {
                status: 'failed',
                error: data.error,
                progress: 0
            });
        });
    }

    /**
     * Handle proof generation request
     */
    async handleProofGeneration(socket, data) {
        const { type, input } = data;

        // Validate proof type
        if (!this.PROOF_TYPES[type.toUpperCase()]) {
            throw new Error('Invalid proof type');
        }

        // Generate proof ID
        const proofId = this.generateProofId();

        // Initialize proof status
        this.activeProofs.set(proofId, {
            type,
            status: 'pending',
            timestamp: Date.now(),
            socket: socket.id
        });

        // Auto-subscribe requesting socket
        this.subscribeToProof(socket, proofId);

        // Add to queue
        const job = await this.proofQueue.addProof({
            proofId,
            type,
            input
        });

        // Send initial status
        socket.emit('proof:initiated', {
            proofId,
            jobId: job.id,
            type
        });

        logger.info('Proof generation initiated:', { proofId, type });
    }

    /**
     * Handle batch proof generation
     */
    async handleBatchProofGeneration(socket, data) {
        const { proofs } = data;

        // Generate batch ID
        const batchId = this.generateProofId('batch');

        // Initialize batch status
        const batchProofs = await Promise.all(
            proofs.map(async (proofData) => {
                const proofId = this.generateProofId();
                
                this.activeProofs.set(proofId, {
                    type: proofData.type,
                    status: 'pending',
                    batchId,
                    timestamp: Date.now(),
                    socket: socket.id
                });

                return {
                    proofId,
                    ...proofData
                };
            })
        );

        // Add batch to queue
        const job = await this.proofQueue.addProof({
            proofId: batchId,
            type: this.PROOF_TYPES.BATCH,
            proofs: batchProofs
        });

        // Subscribe to batch
        this.subscribeToProof(socket, batchId);

        // Send initial status
        socket.emit('proof:batch-initiated', {
            batchId,
            jobId: job.id,
            proofs: batchProofs.map(p => ({
                proofId: p.proofId,
                type: p.type
            }))
        });

        logger.info('Batch proof generation initiated:', { batchId });
    }

    /**
     * Handle proof verification request
     */
    async handleProofVerification(socket, data) {
        const { proof, publicSignals, type } = data;

        try {
            const isValid = await this.proofService.verifyProof(
                type,
                proof,
                publicSignals
            );

            socket.emit('proof:verified', {
                isValid,
                type
            });

        } catch (error) {
            logger.error('Proof verification failed:', error);
            throw error;
        }
    }

    /**
     * Handle proof subscription
     */
    async handleProofSubscription(socket, data) {
        const { proofId } = data;

        // Validate proof exists
        if (!this.activeProofs.has(proofId)) {
            throw new Error('Proof not found');
        }

        // Subscribe socket
        this.subscribeToProof(socket, proofId);

        // Send current status
        const status = this.activeProofs.get(proofId);
        socket.emit('proof:status', {
            proofId,
            ...status
        });
    }

    /**
     * Handle proof unsubscription
     */
    handleProofUnsubscription(socket, data) {
        const { proofId } = data;
        this.unsubscribeFromProof(socket, proofId);
    }

    /**
     * Subscribe socket to proof updates
     */
    subscribeToProof(socket, proofId) {
        if (!this.proofSubscriptions.has(proofId)) {
            this.proofSubscriptions.set(proofId, new Set());
        }
        this.proofSubscriptions.get(proofId).add(socket.id);
    }

    /**
     * Unsubscribe socket from proof updates
     */
    unsubscribeFromProof(socket, proofId) {
        const subscribers = this.proofSubscriptions.get(proofId);
        if (subscribers) {
            subscribers.delete(socket.id);
            if (subscribers.size === 0) {
                this.proofSubscriptions.delete(proofId);
            }
        }
    }

    /**
     * Clear all subscriptions for a socket
     */
    clearSocketSubscriptions(socket) {
        for (const [proofId, subscribers] of this.proofSubscriptions) {
            subscribers.delete(socket.id);
            if (subscribers.size === 0) {
                this.proofSubscriptions.delete(proofId);
            }
        }
    }

    /**
     * Update proof status and notify subscribers
     */
    updateProofStatus(proofId, update) {
        const proofData = this.activeProofs.get(proofId);
        if (!proofData) return;

        // Update status
        this.activeProofs.set(proofId, {
            ...proofData,
            ...update,
            lastUpdated: Date.now()
        });

        // Notify subscribers
        const subscribers = this.proofSubscriptions.get(proofId);
        if (subscribers) {
            const statusUpdate = {
                proofId,
                ...update
            };

            subscribers.forEach(socketId => {
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.emit('proof:status', statusUpdate);
                }
            });
        }

        // Clean up completed/failed proofs after a delay
        if (update.status === 'completed' || update.status === 'failed') {
            setTimeout(() => {
                this.cleanupProof(proofId);
            }, 3600000); // 1 hour
        }
    }

    /**
     * Clean up proof data
     */
    cleanupProof(proofId) {
        this.activeProofs.delete(proofId);
        this.proofSubscriptions.delete(proofId);
    }

    /**
     * Generate unique proof ID
     */
    generateProofId(prefix = 'proof') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Send error to client
     */
    sendError(socket, event, error) {
        socket.emit(event, {
            error: error.message
        });
        logger.error(error);
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        this.activeProofs.clear();
        this.proofSubscriptions.clear();
        await this.proofQueue.cleanup();
    }
}

module.exports = ProofHandler;