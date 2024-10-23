// zkMixing.js
const { Poseidon } = require('circomlib');
const { generateProof, verifyProof } = require('../../zksnark/proofs/generateProof');
const logger = require('../../utils/logger');
const events = require('../../api/websocket/events/eventEmitter');
const EventTypes = require('../../api/websocket/events/eventTypes');

class ZKMixing {
   constructor(torrentManager, proofService) {
       this.torrentManager = torrentManager;
       this.proofService = proofService;
       this.mixingSessions = new Map();
       this.mixingPool = new Set();
       this.MIN_POOL_SIZE = 3;
   }

   /**
    * Create mixing session for peer
    */
   async createMixingSession(peer, torrentId) {
       try {
           // Generate commitment for peer
           const commitment = await this.generatePeerCommitment(peer);

           // Create mixing session
           const sessionId = this.generateSessionId();
           this.mixingSessions.set(sessionId, {
               peer,
               torrentId,
               commitment,
               timestamp: Date.now(),
               mixedPeers: new Set(), 
               status: 'pending'
           });

           // Add to mixing pool
           this.mixingPool.add(sessionId);

           // Try to execute mixing if enough peers
           if (this.mixingPool.size >= this.MIN_POOL_SIZE) {
               await this.executeMixing();
           }

           return sessionId;

       } catch (error) {
           logger.error('Failed to create mixing session:', error);
           throw error;
       }
   }

   /**
    * Execute mixing for available peers
    */
   async executeMixing() {
       try {
           // Select peers for mixing
           const sessionsToMix = Array.from(this.mixingPool)
               .slice(0, this.MIN_POOL_SIZE);

           // Generate mixing proof
           const proof = await this.generateMixingProof(sessionsToMix);
           
           // Mix peers
           for (const sessionId of sessionsToMix) {
               const session = this.mixingSessions.get(sessionId);
               
               // Mix with other peers
               const otherPeers = sessionsToMix
                   .filter(id => id !== sessionId)
                   .map(id => this.mixingSessions.get(id).peer);

               session.mixedPeers = new Set(otherPeers);
               session.status = 'mixed';

               // Remove from mixing pool
               this.mixingPool.delete(sessionId);

               // Emit mixing complete event 
               events.emit(EventTypes.TORRENT.PEER_MIXED, {
                   sessionId,
                   torrentId: session.torrentId,
                   mixedPeers: otherPeers.length
               });
           }

           logger.info(`Mixed ${sessionsToMix.length} peers successfully`);

       } catch (error) {
           logger.error('Mixing execution failed:', error);
           throw error;
       }
   }

   /**
    * Generate ZK proof for mixing
    */
   async generateMixingProof(sessionIds) {
       const sessions = sessionIds.map(id => this.mixingSessions.get(id));
       
       const input = {
           commitments: sessions.map(s => s.commitment),
           nullifiers: sessions.map(s => this.generateNullifier()),
           timestamp: Date.now()
       };

       return this.proofService.generateProof(input, 'mixing');
   }

   /**
    * Get mixed peers for session
    */
   getMixedPeers(sessionId) {
       const session = this.mixingSessions.get(sessionId);
       if (!session) throw new Error('Session not found');
       return Array.from(session.mixedPeers);
   }

   /**
    * Generate commitment for peer
    */
   async generatePeerCommitment(peer) {
       const input = [
           BigInt(peer.id),
           BigInt(peer.port),
           BigInt(Date.now())
       ];
       return Poseidon.hash(input);
   }

   /**
    * Generate unique nullifier
    */
   generateNullifier() {
       return Poseidon.hash([BigInt(Date.now()), BigInt(Math.random() * 1000000)]);
   }

   /**
    * Generate session ID
    */
   generateSessionId() {
       return `mix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
   }

   /**
    * Clean up old sessions
    */
   cleanup() {
       const MAX_AGE = 1000 * 60 * 60; // 1 hour
       const now = Date.now();

       for (const [sessionId, session] of this.mixingSessions) {
           if (now - session.timestamp > MAX_AGE) {
               this.mixingSessions.delete(sessionId);
               this.mixingPool.delete(sessionId);
           }
       }
   }
}

module.exports = ZKMixing;
