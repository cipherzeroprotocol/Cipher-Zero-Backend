const mongoose = require('mongoose');

const TokenSummarySchema = new mongoose.Schema({
    address: {
        type: String,
        required: true,
        unique: true
    },
    name: String,
    symbol: String,
    totalSupply: String,
    holders: Number,
    txCount: Number,
    lastUpdated: Date
});

module.exports = mongoose.model('TokenSummary', TokenSummarySchema);