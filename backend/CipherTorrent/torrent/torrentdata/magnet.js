
var base32 = require('base32');

var LOGGER = require('log4js').getLogger('metadata/magnet.js');

/**
 * Retrieve torrent metadata from magnet URL.
 */
var MagnetMetadata = {
	load: function(url, callback) {

		if (!url.match(/^magnet:/)) {
			callback(new Error('Given URL is not a magnet URL.'));
		}

		LOGGER.debug('Reading magnet metadata from ' + url);

		var parsedUrl = require('url').parse(url, true),
				hash;

		var urns = parsedUrl.query.xt;
		if (!Array.isArray(urns)) {
			urns = [urns];
		}
		urns.some(function(urn) {
			if (urn.match(/^urn:btih:/)) {
				hash = urn.substring(9);
				return true;
			}
		});

		if (!hash) {
			callback(new Error('No supported xt URN provided.'));
		} else {
			var infoHash;
			if (hash.length === 40) {
				infoHash = Buffer.alloc(40, hash, 'hex');
			} else {
				infoHash = Buffer.alloc(Buffer.byteLength(base32.decode(hash)), base32.decode(hash), 'binary');
			}

			if (parsedUrl.query.tr) {
				var trackers = parsedUrl.query.tr;
				if (!Array.isArray(trackers)) {
					trackers = [trackers];
				}
			}

			callback(null, {
				infoHash: infoHash,
				info: {
					name: parsedUrl.query.dn
				},
				'announce-list': trackers
			});
		}
	}
};

module.exports = exports = MagnetMetadata;

