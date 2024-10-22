const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
    address: {
        type: String,
        required: true,
        unique: true
    },
    name: String,
    symbol: String,
    decimals: Number,
    totalSupply: String,
    holders: Number,
    isCompressed: Boolean,
    compressedData: Object,
    lastUpdated: Date
});

module.exports = mongoose.model('Token', TokenSchema);