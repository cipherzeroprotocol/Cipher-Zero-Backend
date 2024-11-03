require('dotenv').config();

const NEON_NETWORKS = {
    mainnet: {
        url: 'https://neon-proxy-mainnet.solana.com',
        chainId: 245022934,
        deployerKey: process.env.NEON_DEPLOYER_KEY,
        gasPrice: 1000000000, // 1 gwei
        confirmations: 2,
        timeoutBlocks: 50,
        networkName: 'neon-mainnet'
    },
    testnet: {
        url: 'https://neon-proxy-testnet.solana.com',
        chainId: 245022926,
        deployerKey: process.env.NEON_DEPLOYER_KEY,
        gasPrice: 1000000000,
        confirmations: 1,
        timeoutBlocks: 50,
        networkName: 'neon-testnet'
    },
    devnet: {
        url: 'https://devnet.neonevm.org',
        chainId: 245022940,
        deployerKey: process.env.NEON_DEPLOYER_KEY,
        gasPrice: 1000000000,
        confirmations: 1,
        timeoutBlocks: 50,
        networkName: 'neon-devnet'
    }
};

const neonConfig = {
    // Current network
    network: process.env.NEON_NETWORK || 'devnet',
    
    // Network configurations
    networks: NEON_NETWORKS,

    // Default transaction settings
    defaultGasLimit: 6000000,
    maxGasLimit: 15000000,
    maxPriorityFeePerGas: 2000000000, // 2 gwei
    
    // Account settings
    accountPrefix: '0x',
    defaultAccount: process.env.NEON_DEFAULT_ACCOUNT,
    
    // Provider settings
    provider: {
        timeout: 10000,
        maximumRetries: 3,
        retryInterval: 1000,
        websocketEndpoint: process.env.NEON_WS_ENDPOINT
    },

    // Deployment settings
    deployment: {
        gasMultiplier: 1.2,
        confirmations: 2,
        timeoutBlocks: 50,
        skipDryRun: false
    },

    // Compiler settings
    compiler: {
        version: '0.8.19',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    }
};

module.exports = neonConfig;
