// Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
   // Message identifiers
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

   // Message content
   encryptedContent: {
       type: Buffer,
       required: true
   },
   
   // Participants
   sender: {
       type: String, // Address
       required: true,
       index: true
   },
   recipient: {
       type: String, // Address  
       required: true,
       index: true
   },

   // ZK proof
   proof: {
       type: String,
       required: true
   },

   // Status
   isRead: {
       type: Boolean,
       default: false
   },
   status: {
       type: String,
       enum: ['pending', 'delivered', 'read'],
       default: 'pending'
   },

   // Metadata
   timestamp: {
       type: Date,
       default: Date.now,
       index: true
   },
   room: {
       type: String,
       index: true
   },
   type: {
       type: String,
       enum: ['direct', 'room'],
       default: 'direct'
   }
}, {
   timestamps: true
});

// Indexes
MessageSchema.index({ sender: 1, timestamp: -1 });
MessageSchema.index({ recipient: 1, timestamp: -1 });
MessageSchema.index({ room: 1, timestamp: -1 });

// Methods
MessageSchema.methods.markAsRead = function() {
   this.isRead = true;
   this.status = 'read';
   return this.save();
};

module.exports = mongoose.model('Message', MessageSchema);
