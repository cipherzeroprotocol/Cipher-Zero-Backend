// src/data/dataCollector.js

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration for data sources
const CONFIG = {
    DATA_SOURCES: [
        { url: 'https://your-data-source-1-url', type: 'json' }, // Replace with actual URL and type
        { url: 'https://your-data-source-2-url', type: 'xml' }  // Replace with actual URL and type
    ],
    OUTPUT_DIR: path.join(__dirname, 'collected_data'),
    TIMEOUT: 10000 // Timeout for requests (in milliseconds)
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR);
}

// Function to fetch data from a URL
async function fetchData(url, type) {
    try {
        const response = await axios.get(url, { timeout: CONFIG.TIMEOUT });
        
        if (response.status === 200) {
            console.log(`Data fetched successfully from ${url}`);
            return response.data;
        } else {
            console.error(`Failed to fetch data from ${url}: ${response.statusText}`);
            return null;
        }
    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error.message);
        return null;
    }
}

// Function to save data to a file
function saveDataToFile(data, filename) {
    try {
        const filePath = path.join(CONFIG.OUTPUT_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Data saved to ${filePath}`);
    } catch (error) {
        console.error(`Error saving data to file ${filename}:`, error.message);
    }
}

// Function to process XML data (if applicable)
function processXMLData(data) {
    // Example: Convert XML to JSON (requires xml2js or similar library)
    const xml2js = require('xml2js');
    let jsonData = {};
    xml2js.parseString(data, (err, result) => {
        if (err) {
            console.error('Error parsing XML:', err.message);
        } else {
            jsonData = result;
        }
    });
    return jsonData;
}

// Function to collect data from configured sources
async function collectData() {
    for (const source of CONFIG.DATA_SOURCES) {
        const data = await fetchData(source.url, source.type);

        if (data) {
            let processedData = data;
            
            // Process data based on type
            if (source.type === 'xml') {
                processedData = processXMLData(data);
            }
            
            const filename = `data_${Date.now()}.${source.type === 'xml' ? 'json' : 'json'}`;
            saveDataToFile(processedData, filename);
        }
    }
}

// Export the collectData function for use in other parts of the application
module.exports = {
    collectData
};
