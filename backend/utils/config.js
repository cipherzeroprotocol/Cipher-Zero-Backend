require('dotenv').config();
require('dotenv').config();

const config = {
    PORT: process.env.PORT || 3000,
    DB_URL: process.env.DB_URL || 'mongodb://localhost:27017/bittheta',
    API_KEY: process.env.API_KEY || 'your-api-key',
    ENCRYPTION_ALGORITHM: process.env.ENCRYPTION_ALGORITHM || 'aes-256-cbc',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'your-encryption-key-in-hex',
    ENCRYPTION_IV: process.env.ENCRYPTION_IV || 'your-initialization-vector-in-hex',
    TIMEOUT: process.env.TIMEOUT || 5000
};


module.exports = config;
