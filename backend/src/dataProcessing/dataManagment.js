// src/dataProcessing/dataManagement.js

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

/**
 * Archives old data files to save space.
 * @param {string} sourceDir - Directory containing files to archive.
 * @param {string} archivePath - Path where the archive file will be saved.
 */
const archiveOldData = (sourceDir, archivePath) => {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(archivePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`Archived ${archive.pointer()} total bytes.`);
            resolve();
        });

        archive.on('error', (err) => {
            reject(err);
        });

        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
};

/**
 * Cleans up old data files based on certain criteria.
 * @param {string} dir - Directory to clean up.
 * @param {number} days - Number of days to keep files.
 */
const cleanUpOldData = (dir, days) => {
    const now = Date.now();
    const cutoff = now - days * 24 * 60 * 60 * 1000; // Convert days to milliseconds

    fs.readdir(dir, (err, files) => {
        if (err) throw err;

        files.forEach(file => {
            const filePath = path.join(dir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) throw err;

                if (stats.mtimeMs < cutoff) {
                    fs.unlink(filePath, (err) => {
                        if (err) throw err;
                        console.log(`Deleted old file: ${filePath}`);
                    });
                }
            });
        });
    });
};

module.exports = { archiveOldData, cleanUpOldData };
