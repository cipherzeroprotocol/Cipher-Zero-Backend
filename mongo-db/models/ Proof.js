// Proof.js
const mongoose = require('mongoose');

const ProofSchema = new mongoose.Schema({
   // Proof identifiers
   commitment: {
       type: String,
       required: true,
       unique: true,
       index: true
   },
   nullifier: {
       type: String,
       required: true,
       unique: true,
       index: true
   },

   // Proof data
   proof: {
       type: String,
       required: true
   },
   publicSignals: [String],
   
   // Proof details
   type: {
       type: String,
       enum: ['message', 'file', 'transfer', 'identity', 'mixing'],
       required: true,
       index: true
   },
   status: {
       type: String,
       enum: ['pending', 'verified', 'invalid'],
       default: 'pending'
   },

   // Related entities
   messageId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'Message',
       index: true
   },
   fileId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: 'File',
       index: true
   },
   userId: {
       type: String, // Address
       index: true
   },

   // Verification details
   verifiedAt: Date,
   verifiedBy: String, // Address of verifier
   error: String

}, {
   timestamps: true
});

// Indexes
ProofSchema.index({ type: 1, status: 1 });
ProofSchema.index({ userId: 1, type: 1 });

// Methods
ProofSchema.methods.verify = function(verifier) {
   this.status = 'verified';
   this.verifiedAt = new Date();
   this.verifiedBy = verifier;
   return this.save();
};

ProofSchema.methods.invalidate = function(error) {
   this.status = 'invalid';
   this.error = error;
   return this.save();
};

module.exports = mongoose.model('Proof', ProofSchema);