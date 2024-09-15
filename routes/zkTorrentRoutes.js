const express = require('express');
const zkTorrentController = require('../../controllers/zkTorrentController');

const router = express.Router();

router.post('/peer-discovery', zkTorrentController.initiateZKPeerDiscovery.bind(zkTorrentController));
router.post('/verify-peer', zkTorrentController.verifyZKPeer.bind(zkTorrentController));
router.post('/create-info-hash', zkTorrentController.createZKInfoHash.bind(zkTorrentController));
router.post('/verify-info-hash', zkTorrentController.verifyZKInfoHash.bind(zkTorrentController));
router.post('/generate-piece-proof', zkTorrentController.generateZKPieceProof.bind(zkTorrentController));
router.post('/verify-piece', zkTorrentController.verifyZKPiece.bind(zkTorrentController));
router.post('/encrypt-message', zkTorrentController.encryptPeerMessage.bind(zkTorrentController));
router.post('/decrypt-message', zkTorrentController.decryptPeerMessage.bind(zkTorrentController));
router.get('/generate-dh-key-pair', zkTorrentController.generateDHKeyPair.bind(zkTorrentController));
router.post('/compute-shared-secret', zkTorrentController.computeSharedSecret.bind(zkTorrentController));

module.exports = router;