// peerAnonymizer.js
const { Poseidon } = require('circomlib');
const { generateProof } = require('../../zksnark/proofs/generateProof');
const logger = require('../../utils/logger');
const events = require('../../api/websocket/events/eventEmitter');
const EventTypes = require('../../api/websocket/events/eventTypes');

class PeerAnonymizer {
   constructor(torrentManager, proofService) {
       this.torrentManager = torrentManager;
       this.proofService = proofService;
       this.anonymizedPeers = new Map();
       this.setupEventHandlers();
   }

   /**
    * Anonymize peer connection
    */
   async anonymizePeer(peer, torrentId) {
       try {
           // Generate anonymous identity
           const anonymousId = await this.generateAnonymousId(peer);

           // Generate proof of identity
           const proof = await this.generateIdentityProof(peer, anonymousId);

           // Store anonymized peer
           this.anonymizedPeers.set(anonymousId, {
               originalPeer: peer,
               torrentId,
               proof,
               timestamp: Date.now()
           });

           // Create anonymous peer object
           const anonymousPeer = {
               id: anonymousId,
               port: this.generateRandomPort(),
               anonymized: true
           };

           events.emit(EventTypes.TORRENT.PEER_ANONYMIZED, {
               torrentId,
               originalPeerId: peer.id,
               anonymousId
           });

           return anonymousPeer;

       } catch (error) {
           logger.error('Peer anonymization failed:', error);
           throw error;
       }
   }

   /**
    * Generate anonymous identity for peer
    */
   async generateAnonymousId(peer) {
       const input = [
           BigInt(peer.id),
           BigInt(Date.now()),
           BigInt(Math.random() * 1000000)
       ];
       return Poseidon.hash(input).toString();
   }

   /**
    * Generate proof of identity
    */
   async generateIdentityProof(peer, anonymousId) {
       const input = {
           peerId: peer.id,
           anonymousId,
           timestamp: Date.now()
       };

       return this.proofService.generateProof(input, 'identity');
   }

   /**
    * Verify anonymous peer identity
    */
   async verifyAnonymousPeer(anonymousId, proof) {
       try {
           const peer = this.anonymizedPeers.get(anonymousId);
           if (!peer) return false;

           return this.proofService.verifyProof(proof, 'identity');

       } catch (error) {
           logger.error('Peer verification failed:', error);
           return false;
       }
   }

   /**
    * Get original peer from anonymous ID
    */
   getOriginalPeer(anonymousId) {
       const peer = this.anonymizedPeers.get(anonymousId);
       return peer ? peer.originalPeer : null;
   }

   /**
    * Setup event handlers
    */
   setupEventHandlers() {
       events.on(EventTypes.TORRENT.PEER_CONNECTED, async ({ peer, torrentId }) => {
           try {
               await this.anonymizePeer(peer, torrentId);
           } catch (error) {
               logger.error('Failed to anonymize connected peer:', error);
           }
       });

       events.on(EventTypes.TORRENT.PEER_DISCONNECTED, ({ peer }) => {
           // Cleanup anonymized peer
           for (const [anonymousId, anonPeer] of this.anonymizedPeers) {
               if (anonPeer.originalPeer.id === peer.id) {
                   this.anonymizedPeers.delete(anonymousId);
               }
           }
       });
   }

   /**
    * Generate random port number
    */
   generateRandomPort() {
       return 1024 + Math.floor(Math.random() * 64511); // 1024-65535
   }

   /**
    * Clean up old anonymized peers
    */
   cleanup() {
       const MAX_AGE = 1000 * 60 * 60 * 24; // 24 hours
       const now = Date.now();

       for (const [anonymousId, peer] of this.anonymizedPeers) {
           if (now - peer.timestamp > MAX_AGE) {
               this.anonymizedPeers.delete(anonymousId);
           }
       }
   }
}

module.exports = PeerAnonymizer;