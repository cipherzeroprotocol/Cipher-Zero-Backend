
var bencode = require('../util/bencode'),
    protocol = require('./protocol'),
    util = require('util');

var EventEmitter = require('events').EventEmitter;

var LOGGER = require('log4js').getLogger('tracker.js');

var CONNECTING = 'connecting';
var ERROR = 'error';
var STOPPED = 'stopped';
var WAITING = 'waiting';

var ANNOUNCE_START_INTERVAL = 5;
'use strict';

const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;
const crypto = require('crypto');
const torrentParser = require('./torrent-parser');
const util = require('./util');

module.exports.getPeers = (torrent, callback) => {
  const socket = dgram.createSocket('udp4');
  const url = torrent.announce.toString('utf8');

  // 1. send connect request
  udpSend(socket, buildConnReq(), url);

  socket.on('message', response => {
    if (respType(response) === 'connect') {
      // 2. receive and parse connect response
      const connResp = parseConnResp(response);
      // 3. send announce request
      const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
      udpSend(socket, announceReq, url);
    } else if (respType(response) === 'announce') {
      // 4. parse announce response
      const announceResp = parseAnnounceResp(response);
      // 5. pass peers to callback
      callback(announceResp.peers);
    }
  });
};

function udpSend(socket, message, rawUrl, callback=()=>{}) {
  const url = urlParse(rawUrl);
  socket.send(message, 0, message.length, url.port, url.hostname, callback);
}

function respType(resp) {
  const action = resp.readUInt32BE(0);
  if (action === 0) return 'connect';
  if (action === 1) return 'announce';
}

function buildConnReq() {
  const buf = Buffer.allocUnsafe(16);

  // connection id
  buf.writeUInt32BE(0x417, 0);
  buf.writeUInt32BE(0x27101980, 4);
  // action
  buf.writeUInt32BE(0, 8);
  // transaction id
  crypto.randomBytes(4).copy(buf, 12);

  return buf;
}

function parseConnResp(resp) {
  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    connectionId: resp.slice(8)
  }
}

function buildAnnounceReq(connId, torrent, port=6881) {
  const buf = Buffer.allocUnsafe(98);

  // connection id
  connId.copy(buf, 0);
  // action
  buf.writeUInt32BE(1, 8);
  // transaction id
  crypto.randomBytes(4).copy(buf, 12);
  // info hash
  torrentParser.infoHash(torrent).copy(buf, 16);
  // peerId
  util.genId().copy(buf, 36);
  // downloaded
  Buffer.alloc(8).copy(buf, 56);
  // left
  torrentParser.size(torrent).copy(buf, 64);
  // uploaded
  Buffer.alloc(8).copy(buf, 72);
  // event
  buf.writeUInt32BE(0, 80);
  // ip address
  buf.writeUInt32BE(0, 84);
  // key
  crypto.randomBytes(4).copy(buf, 88);
  // num want
  buf.writeInt32BE(-1, 92);
  // port
  buf.writeUInt16BE(port, 96);

  return buf;
}

function parseAnnounceResp(resp) {
  function group(iterable, groupSize) {
    let groups = [];
    for (let i = 0; i < iterable.length; i += groupSize) {
      groups.push(iterable.slice(i, i + groupSize));
    }
    return groups;
  }

  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    leechers: resp.readUInt32BE(8),
    seeders: resp.readUInt32BE(12),
    peers: group(resp.slice(20), 6).map(address => {
      return {
        ip: address.slice(0, 4).join('.'),
        port: address.readUInt16BE(4)
      }
    })
  }
} 
var Tracker = function(urls) {
  EventEmitter.call(this);
  if (!Array.isArray(urls)) {
    this._urls = [urls];
  } else {
    this._urls = urls;
  }
  // TODO: need to step through URLs as part of announce process
  this.url = require('url').parse(this._urls[0]);
  this.torrent = null;
  this.state = STOPPED;
  this.seeders = 0;
  this.leechers = 0;
};
util.inherits(Tracker, EventEmitter);

Tracker.prototype.setTorrent = function(torrent) {
  this.torrent = torrent;
};

Tracker.prototype.start = function(callback) {
  this.callback = callback;
  this._announce('started');
};

Tracker.prototype.stop = function() {
  this._announce('stopped');
};

Tracker.prototype._announce = function(event) {
  
  LOGGER.debug('Announce' + (event ? ' ' + event : ''));

  var handlerClass = protocol[this.url.protocol],
      tracker = this;

  if (handlerClass) {
    var handler = new handlerClass();
    var data = {
      peer_id: this.torrent.clientId,
      info_hash: this.torrent.infoHash,
      port: this.torrent.clientPort
    };
    this.state = CONNECTING;
    handler.handle(this, data, event, function(info, error) {
      if (error) {
        LOGGER.warn('announce error from ' + tracker.url.href + ': ' + error.message);
        tracker.state = ERROR;
        tracker.errorMessage = error.message;
        if (event === 'started') {
          LOGGER.warn('retry announce \'started\' in ' + ANNOUNCE_START_INTERVAL + 's');
          setTimeout(function() {
            tracker._announce('started');
          }, ANNOUNCE_START_INTERVAL * 1000);
        }
      } else {
        if (info.trackerId) {
          tracker.trackerId = info.trackerId;
        }
        tracker.state = WAITING;
        if (event === 'started') {
          var interval = info.interval;
          if (tracker.timeoutId) {
            clearInterval(tracker.timeoutId);
          }
          if (interval) {
            tracker.timeoutId = setInterval(function() {
              tracker._announce(null);
            }, interval * 1000);
          }
        } else if (event === 'stopped') {
          clearInterval(tracker.timeoutId);
          delete tracker.timeoutId;
          tracker.state = STOPPED;
        }
      }
      tracker._updateInfo(info);
    });
  }
};

Tracker.prototype._updateInfo = function(data) {
  LOGGER.debug('Updating details from tracker. ' + (data && data.peers ? data.peers.length : 0) + ' new peers');
  if (data) {
    this.seeders = data.seeders || 0;
    this.leechers = data.leechers || 0;
    if (data.peers) {
      for (var i = 0; i < data.peers.length; i++) {
        var peer = data.peers[i];
        this.callback(peer.peer_id, peer.ip, peer.port);
      }
    }
    this.emit('updated');
  }
};

Tracker.createTrackers = function(announce, announceList) {
  var trackers = [];
  if (announceList) {
    announceList.forEach(function(announce) {
      trackers.push(new Tracker(announce));
    });
  } else {
    trackers.push(new Tracker(announce));
  }
  return trackers;
};

module.exports = Tracker;