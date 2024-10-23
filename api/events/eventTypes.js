// eventTypes.js
/**
* Defines all event types used in Cipher Zero Protocol
*/
const EventTypes = {
    // File Events
    FILE: {
        UPLOAD_STARTED: 'file:upload:started',
        UPLOAD_PROGRESS: 'file:upload:progress', 
        UPLOAD_COMPLETED: 'file:upload:completed',
        UPLOAD_FAILED: 'file:upload:failed',
        
        DOWNLOAD_STARTED: 'file:download:started',
        DOWNLOAD_PROGRESS: 'file:download:progress',
        DOWNLOAD_COMPLETED: 'file:download:completed', 
        DOWNLOAD_FAILED: 'file:download:failed',
 
        PROOF_GENERATED: 'file:proof:generated',
        PROOF_VERIFIED: 'file:proof:verified'
    },
 
    // Messaging Events 
    MESSAGE: {
        SENT: 'message:sent',
        RECEIVED: 'message:received',
        ENCRYPTED: 'message:encrypted',
        DECRYPTED: 'message:decrypted',
        PROOF_GENERATED: 'message:proof:generated',
        PROOF_VERIFIED: 'message:proof:verified'
    },
 
    // BitTorrent Events
    TORRENT: {
        CREATED: 'torrent:created',
        STARTED: 'torrent:started',
        STOPPED: 'torrent:stopped',
        PEER_CONNECTED: 'torrent:peer:connected',
        PEER_DISCONNECTED: 'torrent:peer:disconnected',
        PIECE_RECEIVED: 'torrent:piece:received',
        SEEDING_STARTED: 'torrent:seeding:started',
        SEEDING_STOPPED: 'torrent:seeding:stopped'
    },
 
    // ZK Proof Events
    PROOF: {
        GENERATION_STARTED: 'proof:generation:started',
        GENERATION_COMPLETED: 'proof:generation:completed',
        GENERATION_FAILED: 'proof:generation:failed',
        VERIFICATION_STARTED: 'proof:verification:started',
        VERIFICATION_COMPLETED: 'proof:verification:completed',
        VERIFICATION_FAILED: 'proof:verification:failed'
    },
 
    // Chain Sync Events
    CHAIN: {
        SYNC_STARTED: 'chain:sync:started',
        SYNC_PROGRESS: 'chain:sync:progress',
        SYNC_COMPLETED: 'chain:sync:completed',
        SYNC_FAILED: 'chain:sync:failed',
        BLOCK_RECEIVED: 'chain:block:received',
        REORG_DETECTED: 'chain:reorg:detected'
    },
 
    // Contract Events
    CONTRACT: {
        INTERACTION_STARTED: 'contract:interaction:started',
        INTERACTION_COMPLETED: 'contract:interaction:completed',
        INTERACTION_FAILED: 'contract:interaction:failed',
        EVENT_RECEIVED: 'contract:event:received'
    },
 
    // Room Events
    ROOM: {
        CREATED: 'room:created',
        JOINED: 'room:joined',
        LEFT: 'room:left',
        DELETED: 'room:deleted',
        MEMBER_JOINED: 'room:member:joined',
        MEMBER_LEFT: 'room:member:left'
    },
 
    // System Events
    SYSTEM: {
        ERROR: 'system:error',
        WARNING: 'system:warning',
        INFO: 'system:info',
        READY: 'system:ready',
        SHUTDOWN: 'system:shutdown'
    }
 };
 
 module.exports = EventTypes;