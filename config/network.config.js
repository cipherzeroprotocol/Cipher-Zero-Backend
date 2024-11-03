const SOLANA_NETWORKS = {
    mainnet: {
        url: 'https://api.mainnet-beta.solana.com',
        wsUrl: 'wss://api.mainnet-beta.solana.com',
        network: 'mainnet-beta'
    },
    testnet: {
        url: 'https://api.testnet.solana.com',
        wsUrl: 'wss://api.testnet.solana.com',
        network: 'testnet'
    },
    devnet: {
        url: 'https://api.devnet.solana.com',
        wsUrl: 'wss://api.devnet.solana.com',
        network: 'devnet'
    }
};

const networkConfig = {
    // Solana configuration
    solana: {
        network: process.env.SOLANA_NETWORK || 'devnet',
        networks: SOLANA_NETWORKS,
        commitment: 'confirmed',
        preflightCommitment: 'processed',
        confirmTransactionInitialTimeout: 60000,
        skipPreflight: false
    },

    // BitTorrent configuration
    bittorrent: {
        trackers: [
            'udp://tracker.opentrackr.org:1337/announce',
            'udp://tracker.openbittorrent.com:6969/announce'
        ],
        dht: {
            bootstrap: [
                'router.bittorrent.com:6881',
                'router.utorrent.com:6881'
            ],
            maxPeers: 50,
            minPeers: 10
        },
        encryption: {
            required: true,
            enforcePrivacy: true
        },
        timeout: 30000,
        maxConnections: 55,
        uploadRateLimit: 1024 * 1024, // 1MB/s
        downloadRateLimit: 1024 * 1024 // 1MB/s
    },

    // WebSocket configuration
    websocket: {
        port: process.env.WS_PORT || 8080,
        pingInterval: 30000,
        pingTimeout: 5000,
        clientTracking: true,
        maxPayload: 1024 * 1024 // 1MB
    },

    // IPFS configuration (optional backup storage)
    ipfs: {
        host: process.env.IPFS_HOST || 'ipfs.infura.io',
        port: process.env.IPFS_PORT || 5001,
        protocol: 'https',
        timeout: 30000
    },

    // API configuration
    api: {
        port: process.env.API_PORT || 3000,
        host: process.env.API_HOST || 'localhost',
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization']
        },
        rateLimiting: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        }
    },

    // Database configuration
    database: {
        url: process.env.MONGODB_URL,
        name: process.env.DB_NAME || 'cipher_zero',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: true
        }
    },

    // Cache configuration
    cache: {
        type: 'redis',
        url: process.env.REDIS_URL,
        ttl: 3600, // 1 hour
        prefix: 'cz:'
    }
};

module.exports = networkConfig;