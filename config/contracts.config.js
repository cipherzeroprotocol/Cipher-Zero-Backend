const FileRegistryABI = require('../blockchain/abis/FileRegistry.json');
const MessageRegistryABI = require('../blockchain/abis/MessageRegistry.json');
const PrivacyPoolABI = require('../blockchain/abis/PrivacyPool.json');
const CipherZeroTokenABI = require('../blockchain/abis/CipherZeroToken.json');

const contractsConfig = {
    // Contract deployment addresses
    addresses: {
        mainnet: {
            fileRegistry: process.env.MAINNET_FILE_REGISTRY_ADDRESS,
            messageRegistry: process.env.MAINNET_MESSAGE_REGISTRY_ADDRESS,
            privacyPool: process.env.MAINNET_PRIVACY_POOL_ADDRESS,
            cipherZeroToken: process.env.MAINNET_CZT_ADDRESS
        },
        testnet: {
            fileRegistry: process.env.TESTNET_FILE_REGISTRY_ADDRESS,
            messageRegistry: process.env.TESTNET_MESSAGE_REGISTRY_ADDRESS,
            privacyPool: process.env.TESTNET_PRIVACY_POOL_ADDRESS,
            cipherZeroToken: process.env.TESTNET_CZT_ADDRESS
        },
        devnet: {
            fileRegistry: process.env.DEVNET_FILE_REGISTRY_ADDRESS,
            messageRegistry: process.env.DEVNET_MESSAGE_REGISTRY_ADDRESS,
            privacyPool: process.env.DEVNET_PRIVACY_POOL_ADDRESS,
            cipherZeroToken: process.env.DEVNET_CZT_ADDRESS
        }
    },

    // Contract ABIs
    abis: {
        fileRegistry: FileRegistryABI,
        messageRegistry: MessageRegistryABI,
        privacyPool: PrivacyPoolABI,
        cipherZeroToken: CipherZeroTokenABI
    },

    // Contract initialization settings
    initialization: {
        fileRegistry: {
            maxFileSize: '1073741824', // 1GB in bytes
            supportedFileTypes: ['*'],
            defaultPermissions: 'read'
        },
        messageRegistry: {
            maxMessageSize: '1048576', // 1MB in bytes
            retentionPeriod: '2592000' // 30 days in seconds
        },
        privacyPool: {
            minDeposit: '1000000000000000000', // 1 token
            maxDeposit: '1000000000000000000000' // 1000 tokens
        }
    },

    // Contract interaction settings
    settings: {
        gasLimitMultiplier: 1.2,
        maxRetries: 3,
        retryDelay: 1000,
        confirmationBlocks: 2
    },

    // Contract events to monitor
    events: {
        fileRegistry: [
            'FileStored',
            'FileShared',
            'FileDeleted'
        ],
        messageRegistry: [
            'MessageStored',
            'MessageRead'
        ],
        privacyPool: [
            'Deposit',
            'Withdrawal'
        ]
    }
};

module.exports = contractsConfig;