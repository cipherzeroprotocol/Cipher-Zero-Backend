// PeerStats.js
const mongoose = require('mongoose');

const PeerStatsSchema = new mongoose.Schema({
   // Peer identifiers
   peerId: {
       type: String,
       required: true,
       unique: true,
       index: true
   },
   anonymousId: {
       type: String,
       index: true
   },

   // Connection stats
   connections: {
       total: { type: Number, default: 0 },
       active: { type: Number, default: 0 },
       failed: { type: Number, default: 0 }
   },
   lastSeen: {
       type: Date,
       index: true
   },
   uptime: {
       type: Number,
       default: 0 // Total seconds online
   },

   // Transfer stats
   bandwidth: {
       uploaded: { type: Number, default: 0 },
       downloaded: { type: Number, default: 0 },
       ratio: { type: Number, default: 0 }
   },
   files: {
       shared: { type: Number, default: 0 },
       completed: { type: Number, default: 0 }
   },

   // Performance metrics
   latency: {
       average: { type: Number, default: 0 },
       min: Number,
       max: Number
   },
   reliability: {
       score: { 
           type: Number,
           default: 0,
           min: 0,
           max: 100
       },
       successfulTransfers: { type: Number, default: 0 },
       failedTransfers: { type: Number, default: 0 }
   },

   // Privacy metrics
   mixingSessions: {
       total: { type: Number, default: 0 },
       successful: { type: Number, default: 0 }
   },
   anonymityScore: {
       type: Number,
       default: 0,
       min: 0,
       max: 100
   }
}, {
   timestamps: true
});

// Indexes
PeerStatsSchema.index({ 'reliability.score': -1 });
PeerStatsSchema.index({ 'anonymityScore': -1 });
PeerStatsSchema.index({ lastSeen: -1 });

// Methods
PeerStatsSchema.methods.updateBandwidth = function(uploaded, downloaded) {
   this.bandwidth.uploaded += uploaded;
   this.bandwidth.downloaded += downloaded;
   this.bandwidth.ratio = this.bandwidth.uploaded / Math.max(1, this.bandwidth.downloaded);
   return this.save();
};

PeerStatsSchema.methods.updateReliability = function(success) {
   if (success) {
       this.reliability.successfulTransfers++;
   } else {
       this.reliability.failedTransfers++;
   }
   
   const total = this.reliability.successfulTransfers + this.reliability.failedTransfers;
   this.reliability.score = (this.reliability.successfulTransfers / total) * 100;
   
   return this.save();
};

PeerStatsSchema.methods.recordMixingSession = function(success) {
   this.mixingSessions.total++;
   if (success) {
       this.mixingSessions.successful++;
   }
   
   this.anonymityScore = (this.mixingSessions.successful / this.mixingSessions.total) * 100;
   
   return this.save();
};

module.exports = mongoose.model('PeerStats', PeerStatsSchema);