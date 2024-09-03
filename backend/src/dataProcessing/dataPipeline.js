// src/dataProcessing/dataPipeline.js

const { Transform } = require('stream');
const { pipeline } = require('stream');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

// Promisify the pipeline function for async/await support
const pipelineAsync = promisify(pipeline);

/**
 * A Transform stream for data transformation.
 */
class DataTransformer extends Transform {
    constructor(options) {
        super(options);
    }

    _transform(chunk, encoding, callback) {
        // Example transformation: Convert chunk to uppercase
        this.push(chunk.toString().toUpperCase());
        callback();
    }
}

/**
 * Manages the data pipeline from ingestion to loading.
 * @param {string} inputFilePath - Path to the input data file.
 * @param {string} outputFilePath - Path to the output data file.
 */
const runPipeline = async (inputFilePath, outputFilePath) => {
    try {
        const inputStream = fs.createReadStream(inputFilePath);
        const outputStream = fs.createWriteStream(outputFilePath);
        const transformer = new DataTransformer();

        await pipelineAsync(
            inputStream,
            transformer,
            outputStream
        );

        console.log('Data pipeline completed successfully.');
    } catch (error) {
        console.error('Error in data pipeline:', error);
    }
};

module.exports = { runPipeline };
