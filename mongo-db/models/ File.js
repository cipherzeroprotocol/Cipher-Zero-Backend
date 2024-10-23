// File.js
const mongoose = require('mongoose');

const ChunkSchema = new mongoose.Schema({
   index: Number,
   size: Number,
   hash: String,
   encryptionKey: {
       type: Buffer,
       select: false // Don't return by default for security
   },
   iv: Buffer,
   authTag: Buffer
});

const FileSchema = new mongoose.Schema({
   // File identifiers
   fileId: {
       type: String,
       required: true,
       unique: true,
       index: true
   },
   magnetLink: {
       type: String,
       required: true
   },
   
   // File metadata
   name: String,
   size: Number,
   mimeType: String,
   hash: String,
   
   // Encryption details
   chunks: [ChunkSchema],
   encryptionProof: {
       type: String,
       required: true
   },
   
   // Access control  
   owner: {
       type: String, // Address
       required: true,
       index: true
   },
   sharedWith: [{
       address: String,
       permissions: {
           type: String,
           enum: ['read', 'write'],
           default: 'read'
       },
       expiresAt: Date
   }],

   // BitTorrent stats
   seeders: {
       type: Number,
       default: 0
   },
   leechers: {
       type: Number, 
       default: 0
   },
   downloads: {
       type: Number,
       default: 0
   },

   // Status
   status: {
       type: String,
       enum: ['uploading', 'ready', 'error'],
       default: 'uploading'
   },
   error: String
}, {
   timestamps: true
});

// Indexes
FileSchema.index({ 'sharedWith.address': 1 });
FileSchema.index({ owner: 1, createdAt: -1 });

// Methods
FileSchema.methods.share = function(address, permissions = 'read', expiresAt = null) {
   this.sharedWith.push({ address, permissions, expiresAt });
   return this.save();
};

FileSchema.methods.updateStats = function(seeders, leechers) {
   this.seeders = seeders;
   this.leechers = leechers;
   return this.save();
};

module.exports = mongoose.model('File', FileSchema);