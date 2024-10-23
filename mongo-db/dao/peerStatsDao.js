const PeerStats = require('../models/PeerStats');
const logger = require('../../utils/logger');

class PeerStatsDao {
   /**
    * Create or update peer stats
    */
   async updatePeerStats(peerId, stats) {
       try {
           let peerStats = await PeerStats.findOne({ peerId });

           if (!peerStats) {
               peerStats = new PeerStats({
                   peerId,
                   ...stats
               });
           } else {
               Object.assign(peerStats, stats);
           }

           peerStats.lastSeen = new Date();
           await peerStats.save();

           return peerStats;

       } catch (error) {
           logger.error(`Failed to update peer stats ${peerId}:`, error);
           throw error;
       }
   }

   /**
    * Update bandwidth stats
    */
   async updateBandwidth(peerId, uploaded, downloaded) {
       try {
           const peerStats = await PeerStats.findOne({ peerId });
           if (!peerStats) throw new Error('Peer stats not found');

           await peerStats.updateBandwidth(uploaded, downloaded);
           return peerStats;

       } catch (error) {
           logger.error(`Failed to update bandwidth for peer ${peerId}:`, error);
           throw error;
       }
   }

   /**
    * Update reliability score
    */
   async updateReliability(peerId, success) {
       try {
           const peerStats = await PeerStats.findOne({ peerId });
           if (!peerStats) throw new Error('Peer stats not found');

           await peerStats.updateReliability(success);
           return peerStats;

       } catch (error) {
           logger.error(`Failed to update reliability for peer ${peerId}:`, error);
           throw error;
       }
   }

   /**
    * Record mixing session
    */
   async recordMixingSession(peerId, success) {
       try {
           const peerStats = await PeerStats.findOne({ peerId });
           if (!peerStats) throw new Error('Peer stats not found');

           await peerStats.recordMixingSession(success);
           return peerStats;

       } catch (error) {
           logger.error(`Failed to record mixing session for peer ${peerId}:`, error);
           throw error;
       }
   }

   /**
    * Get top peers by reliability
    */
   async getTopPeers(limit = 10) {
       try {
           return await PeerStats.find()
               .sort({ 'reliability.score': -1 })
               .limit(limit);

       } catch (error) {
           logger.error('Failed to get top peers:', error);
           throw error;
       }
   }

   /**
    * Clean up inactive peers
    */
   async cleanupInactivePeers(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
       try {
           const cutoff = new Date(Date.now() - maxAge);
           
           const result = await PeerStats.deleteMany({
               lastSeen: { $lt: cutoff }
           });

           logger.info(`Cleaned up ${result.deletedCount} inactive peers`);
           return result.deletedCount;

       } catch (error) {
           logger.error('Failed to clean up inactive peers:', error);
           throw error;
       }
   }
}

module.exports = {
   MessageDao,
   FileDao,
   ProofDao,
   PeerStatsDao
};