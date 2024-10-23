// proofController.js
const { PublicKey, Connection } = require('@solana/web3.js');
const { ProofValidator } = require('../../validation/proofValidator');
const { RoleManager } = require('../../security/roleManager');
const { logger } = require('../../utils/logger');
const { CipherZeroError } = require('../../utils/errors');
const { redis } = require('../../services/redis');
const { metrics } = require('../../services/metrics');

class ProofController {
    constructor(connection) {
        this.connection = connection;
        this.proofValidator = new ProofValidator(connection);
        this.roleManager = new RoleManager(connection);
        this.proofCache = redis.getClient();
        
        // Bind methods
        this.generateProof = this.generateProof.bind(this);
        this.verifyProof = this.verifyProof.bind(this);
        this.revokeProof = this.revokeProof.bind(this);
    }

    async generateProof(req, res) {
        const startTime = Date.now();
        try {
            const { publicKey, data, proofType } = req.body;

            if (!publicKey || !data || !proofType) {
                throw new CipherZeroError('Missing required parameters', 400);
            }

            // Verify user authorization
            const isAuthorized = await this.roleManager.verifyUserRole(publicKey, 'USER');
            if (!isAuthorized) {
                throw new CipherZeroError('Unauthorized', 401);
            }

            // Generate proof
            logger.info(`Generating ${proofType} proof for ${publicKey}`);
            const proof = await this.proofValidator.generateProof(data, proofType);

            // Cache proof
            const cacheKey = `proof:${publicKey}:${proofType}`;
            await this.proofCache.setex(cacheKey, 3600, JSON.stringify(proof));

            // Record metrics
            metrics.proofGenerated(proofType, Date.now() - startTime);

            res.status(200).json({
                success: true,
                proof,
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error(`Proof generation failed: ${error.message}`);
            metrics.proofGenerationFailed(error.name);
            
            res.status(error.status || 500).json({
                success: false,
                error: error.message
            });
        }
    }

    async verifyProof(req, res) {
        const startTime = Date.now();
        try {
            const { proof, publicInputs, proofType } = req.body;

            // Validate inputs
            if (!proof || !publicInputs || !proofType) {
                throw new CipherZeroError('Missing required parameters', 400);
            }

            // Verify proof
            const isValid = await this.proofValidator.validateZkProof(
                proof,
                publicInputs,
                proofType
            );

            // Record metrics
            metrics.proofVerified(proofType, isValid, Date.now() - startTime);

            res.status(200).json({
                success: true,
                isValid,
                verifiedAt: Date.now()
            });
        } catch (error) {
            logger.error(`Proof verification failed: ${error.message}`);
            metrics.proofVerificationFailed(error.name);
            
            res.status(error.status || 500).json({
                success: false,
                error: error.message
            });
        }
    }

    async revokeProof(req, res) {
        try {
            const { proofId, publicKey } = req.body;

            // Verify admin authorization
            const isAdmin = await this.roleManager.verifyUserRole(publicKey, 'ADMIN');
            if (!isAdmin) {
                throw new CipherZeroError('Unauthorized', 401);
            }

            // Revoke proof
            await this.proofValidator.revokeProof(proofId);
            
            // Remove from cache
            await this.proofCache.del(`proof:${proofId}`);

            res.status(200).json({
                success: true,
                message: 'Proof revoked successfully'
            });
        } catch (error) {
            logger.error(`Proof revocation failed: ${error.message}`);
            res.status(error.status || 500).json({
                success: false,
                error: error.message
            });
        }
    }
}
