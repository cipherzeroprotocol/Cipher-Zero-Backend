const WebTorrent = require('webtorrent'); // WebTorrent library for torrent management
const logger = require('../utils/logger'); // Logger for logging events
const EventEmitter = require('events');

class TorrentManager extends EventEmitter {
    constructor() {
        super();
        this.client = new WebTorrent(); // Initialize a new WebTorrent client
    }

    /**
     * Adds a torrent to the client for downloading or seeding.
     * 
     * @param {string} torrentId - The magnet link or torrent file.
     * @returns {Promise} - Resolves when the torrent is added.
     */
    addTorrent(torrentId) {
        return new Promise((resolve, reject) => {
            this.client.add(torrentId, (torrent) => {
                logger.info(`Torrent added: ${torrent.infoHash}`); // Log the infoHash of the added torrent

                // Listen for torrent download progress
                torrent.on('download', (bytes) => {
                    logger.info(`Downloaded: ${bytes} bytes`);
                    this.emit('progress', torrent.progress); // Emit progress event
                });

                // Listen for completion
                torrent.on('done', () => {
                    logger.info(`Torrent download complete: ${torrent.infoHash}`); // Log completion
                    this.emit('completed', torrent); // Emit completion event
                });

                resolve(torrent); // Resolve the promise with the torrent object
            });

            this.client.on('error', (err) => {
                logger.error(`Torrent error: ${err.message}`); // Log errors
                reject(err); // Reject the promise with the error
            });
        });
    }

    /**
     * Stops and removes a torrent from the client.
     * 
     * @param {string} infoHash - The infoHash of the torrent to remove.
     * @returns {Promise} - Resolves when the torrent is removed.
     */
    removeTorrent(infoHash) {
        return new Promise((resolve, reject) => {
            const torrent = this.client.get(infoHash);
            if (!torrent) {
                return reject(new Error('Torrent not found')); // Reject if the torrent does not exist
            }

            torrent.destroy((err) => {
                if (err) {
                    logger.error(`Failed to remove torrent: ${err.message}`); // Log removal error
                    return reject(err); // Reject with the error
                }
                logger.info(`Torrent removed: ${infoHash}`); // Log successful removal
                resolve(); // Resolve the promise
            });
        });
    }

    /**
     * Gets the list of currently added torrents.
     * 
     * @returns {Array} - An array of current torrents.
     */
    getTorrents() {
        return this.client.torrents; // Return the list of torrents
    }
}

module.exports = new TorrentManager(); // Export a singleton instance of TorrentManager
