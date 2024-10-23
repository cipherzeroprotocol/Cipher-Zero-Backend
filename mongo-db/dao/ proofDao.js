// proofDao.js
const Proof = require('../models/Proof');
const logger = require('../../utils/logger');

class ProofDao {
   /**
    * Create new proof
    */
   async createProof(proofData) {
       try {
           const proof = new Proof({
               commitment: proofData.commitment,
               nullifier: proofData.nullifier,
               proof: proofData.proof,
               publicSignals: proofData.publicSignals,
               type: proofData.type,
               messageId: proofData.messageId,
               fileId: proofData.fileId,
               userId: proofData.userId
           });

           await proof.save();
           logger.info(`Proof created with commitment: ${proof.commitment}`);
           return proof;

       } catch (error) {
           logger.error('Failed to create proof:', error);
           throw error;
       }
   }

   /**
    * Get proof by commitment
    */
   async getProofByCommitment(commitment) {
       try {
           return await Proof.findOne({ commitment });
       } catch (error) {
           logger.error(`Failed to get proof ${commitment}:`, error);
           throw error;
       }
   }

   /**
    * Verify proof
    */
   async verifyProof(commitment, verifier) {
       try {
           const proof = await Proof.findOne({ commitment });
           if (!proof) throw new Error('Proof not found');

           await proof.verify(verifier);
           return proof;

       } catch (error) {
           logger.error(`Failed to verify proof ${commitment}:`, error);
           throw error;
       }
   }

   /**
    * Invalidate proof
    */
   async invalidateProof(commitment, error) {
       try {
           const proof = await Proof.findOne({ commitment });
           if (!proof) throw new Error('Proof not found');

           await proof.invalidate(error);
           return proof;

       } catch (error) {
           logger.error(`Failed to invalidate proof ${commitment}:`, error);
           throw error;
       }
   }

   /**
    * Get proofs by type
    */
   async getProofsByType(type, options = {}) {
       try {
           const { offset = 0, limit = 20, status } = options;

           const query = { type };
           if (status) query.status = status;

           return await Proof.find(query)
               .sort({ createdAt: -1 })
               .skip(offset)
               .limit(limit);

       } catch (error) {
           logger.error(`Failed to get proofs of type ${type}:`, error);
           throw error;
       }
   }
}