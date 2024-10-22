const mongoose = require('mongoose');

const TokenHolderSchema = new mongoose.Schema({
    tokenAddress: {
        type: String,
        required: true
    },
    holderAddress: {
        type: String,
        required: true
    },
    balance: String,
    lastUpdated: Date
});

TokenHolderSchema.index({ tokenAddress: 1, holderAddress: 1 }, { unique: true });

module.exports = mongoose.model('TokenHolder', TokenHolderSchema);