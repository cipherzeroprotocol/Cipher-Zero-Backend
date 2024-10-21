const ZKTorrentService = require('../../services/zkTorrentService');
const TorrentPrivacyTools = require('../../privacy/torrent_privacy_tools');
const LOGGER = require('log4js').getLogger('zkTorrentController.js');

class ZKTorrentController {
    constructor() {
        this.zkTorrentService = new ZKTorrentService();
        this.privacyTools = new TorrentPrivacyTools();
    }

    async initialize() {
        await this.zkTorrentService.initialize();
        await this.privacyTools.initialize();
    }

    
  async createTorrent(req, res) {
    try {
      const { file, privateData } = req.body;
      const torrent = await this.zkTorrentService.createTorrent(file, privateData);
      res.json(torrent);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async downloadTorrent(req, res) {
    try {
      const { infoHash } = req.params;
      const torrent = await this.zkTorrentService.downloadTorrent(infoHash);
      res.json(torrent);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async transferData(req, res) {
    try {
      const { data, recipient } = req.body;
      const result = await this.zkTorrentService.transferData(data, recipient);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
    
    async initiateZKPeerDiscovery(req, res) {
        try {
            const { peerId, ip, port } = req.body;
            const pseudonymousId = this.privacyTools.generatePseudonymousId();
            const obfuscatedIp = this.privacyTools.obfuscateIp(ip);

            const { proof, publicSignals } = await this.zkTorrentService.generatePeerDiscoveryProof(
                pseudonymousId,
                obfuscatedIp,
                port
            );

            res.json({ pseudonymousId, obfuscatedIp, port, proof, publicSignals });
        } catch (error) {
            LOGGER.error('Error in initiateZKPeerDiscovery:', error);
            res.status(500).json({ error: 'Failed to initiate ZK peer discovery' });
        }
    }

    async verifyZKPeer(req, res) {
        try {
            const { proof, publicSignals } = req.body;
            const isValid = await this.zkTorrentService.verifyPeerDiscoveryProof(proof, publicSignals);

            res.json({ isValid });
        } catch (error) {
            LOGGER.error('Error in verifyZKPeer:', error);
            res.status(500).json({ error: 'Failed to verify ZK peer' });
        }
    }

    async createZKInfoHash(req, res) {
        try {
            const { infoHash } = req.body;
            const { maskedInfoHash, proof } = await this.privacyTools.maskInfoHash(infoHash);

            res.json({ maskedInfoHash, proof });
        } catch (error) {
            LOGGER.error('Error in createZKInfoHash:', error);
            res.status(500).json({ error: 'Failed to create ZK info hash' });
        }
    }

    async verifyZKInfoHash(req, res) {
        try {
            const { maskedInfoHash, proof } = req.body;
            const isValid = await this.privacyTools.verifyMaskedInfoHash(maskedInfoHash, proof);

            res.json({ isValid });
        } catch (error) {
            LOGGER.error('Error in verifyZKInfoHash:', error);
            res.status(500).json({ error: 'Failed to verify ZK info hash' });
        }
    }

    async generateZKPieceProof(req, res) {
        try {
            const { pieceHash, pieceData } = req.body;
            const { proof, publicSignals } = await this.zkTorrentService.generatePieceVerificationProof(
                pieceHash,
                pieceData
            );

            res.json({ proof, publicSignals });
        } catch (error) {
            LOGGER.error('Error in generateZKPieceProof:', error);
            res.status(500).json({ error: 'Failed to generate ZK piece proof' });
        }
    }

    async verifyZKPiece(req, res) {
        try {
            const { proof, publicSignals } = req.body;
            const isValid = await this.zkTorrentService.verifyPieceVerificationProof(proof, publicSignals);

            res.json({ isValid });
        } catch (error) {
            LOGGER.error('Error in verifyZKPiece:', error);
            res.status(500).json({ error: 'Failed to verify ZK piece' });
        }
    }

    async encryptPeerMessage(req, res) {
        try {
            const { message, sharedSecret } = req.body;
            const encryptedMessage = this.privacyTools.encryptPeerMessage(message, sharedSecret);

            res.json(encryptedMessage);
        } catch (error) {
            LOGGER.error('Error in encryptPeerMessage:', error);
            res.status(500).json({ error: 'Failed to encrypt peer message' });
        }
    }

    async decryptPeerMessage(req, res) {
        try {
            const { encryptedMessage, sharedSecret } = req.body;
            const decryptedMessage = this.privacyTools.decryptPeerMessage(encryptedMessage, sharedSecret);

            res.json({ decryptedMessage });
        } catch (error) {
            LOGGER.error('Error in decryptPeerMessage:', error);
            res.status(500).json({ error: 'Failed to decrypt peer message' });
        }
    }

    async generateDHKeyPair(req, res) {
        try {
            const keyPair = this.privacyTools.generateDHKeyPair();
            res.json(keyPair);
        } catch (error) {
            LOGGER.error('Error in generateDHKeyPair:', error);
            res.status(500).json({ error: 'Failed to generate DH key pair' });
        }
    }

    async computeSharedSecret(req, res) {
        try {
            const { privateKey, otherPublicKey } = req.body;
            const sharedSecret = this.privacyTools.computeSharedSecret(privateKey, otherPublicKey);

            res.json({ sharedSecret });
        } catch (error) {
            LOGGER.error('Error in computeSharedSecret:', error);
            res.status(500).json({ error: 'Failed to compute shared secret' });
        }
    }
}

module.exports = new ZKTorrentController();