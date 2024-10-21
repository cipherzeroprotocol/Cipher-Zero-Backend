const config = require('config');
const fs = require('fs');

// Function to validate the presence of required configurations
const validateConfig = () => {
    const requiredFields = [
        'port',
        'database.uri',
        'jwt.secret',
        'encryptionKey',
        'encryptionAlgorithm',
    ];

    requiredFields.forEach((field) => {
        const keys = field.split('.');
        let value = config;

        keys.forEach((key) => {
            value = value[key];
        });

        if (!value) {
            console.error(`Missing required configuration: ${field}`);
            process.exit(1); // Exit the process with failure
        }
    });
};

// Initialize configuration
const initConfig = () => {
    validateConfig();

    console.log('Configuration loaded successfully.');
    console.log(`Server will run on port: ${config.get('port')}`);
    console.log(`Database URI: ${config.get('database.uri')}`);
};

// Export the initialization function
module.exports = {
    initConfig,
};
