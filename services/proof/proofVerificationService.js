// proofVerificationService.js
const { ProofDao } = require('../../mongo-db/dao');
const logger = require('../../utils/logger');
const events = require('../../api/websocket/events/eventEmitter');
const EventTypes = require('../../api/websocket/events/eventTypes');

class ProofVerificationService {
   constructor(proofDao, verifierContracts) {
       this.proofDao = proofDao;
       this.verifierContracts = verifierContracts; // Map of verifier contracts
       this.verificationCache = new Map();
   }

   /**
    * Verify proof using appropriate verifier
    */
   async verifyProof(proof, circuitType) {
       try {
           events.emit(EventTypes.PROOF.VERIFICATION_STARTED, { circuitType });

           // Check cache
           const cacheKey = this.generateCacheKey(proof);
           if (this.verificationCache.has(cacheKey)) {
               return this.verificationCache.get(cacheKey);
           }

           // Get verifier contract
           const verifier = this.verifierContracts.get(circuitType);
           if (!verifier) {
               throw new Error(`Verifier not found for type: ${circuitType}`);
           }

           // Verify proof on-chain
           const isValid = await verifier.verifyProof(
               proof.proof,
               proof.publicSignals
           );

           // Update proof status in database
           if (isValid) {
               await this.proofDao.verifyProof(
                   proof.commitment,
                   verifier.address
               );
           } else {
               await this.proofDao.invalidateProof(
                   proof.commitment,
                   'Invalid proof'
               );
           }

           // Cache verification result
           this.verificationCache.set(cacheKey, isValid);

           events.emit(EventTypes.PROOF.VERIFICATION_COMPLETED, {
               commitment: proof.commitment,
               isValid
           });

           return isValid;

       } catch (error) {
           events.emit(EventTypes.PROOF.VERIFICATION_FAILED, {
               error: error.message,
               commitment: proof.commitment
           });
           logger.error('Proof verification failed:', error);
           throw error;
       }
   }

   /**
    * Batch verify multiple proofs
    */
   async batchVerifyProofs(proofs, circuitType) {
       try {
           const results = await Promise.all(
               proofs.map(async proof => {
                   try {
                       return {
                           commitment: proof.commitment,
                           isValid: await this.verifyProof(proof, circuitType)
                       };
                   } catch (error) {
                       return {
                           commitment: proof.commitment,
                           isValid: false,
                           error: error.message
                       };
                   }
               })
           );

           return results;

       } catch (error) {
           logger.error('Batch proof verification failed:', error);
           throw error;
       }
   }

   /**
    * Verify proof by commitment
    */
   async verifyProofByCommitment(commitment) {
       try {
           const proof = await this.proofDao.getProofByCommitment(commitment);
           if (!proof) {
               throw new Error('Proof not found');
           }

           return await this.verifyProof(proof, proof.type);

       } catch (error) {
           logger.error(`Failed to verify proof ${commitment}:`, error);
           throw error;
       }
   }

   /**
    * Generate verification cache key
    */
   generateCacheKey(proof) {
       return `${proof.commitment}:${proof.nullifier}`;
   }

   /**
    * Clean up verification cache
    */
   cleanup() {
       this.verificationCache.clear();
   }
}

module.exports = {
   ProofGenerationService,
   ProofVerificationService
};