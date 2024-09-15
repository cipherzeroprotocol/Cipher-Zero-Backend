const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileControllers');
const zkTorrentController = require('../controllers/zkTorrentController');
const auth = require('../middleware/auth'); // Assuming you have an auth middleware

// Existing file routes
router.post('/upload', auth, fileController.uploadFile);
router.get('/download/:fileId', auth, fileController.downloadFile);
router.get('/list', auth, fileController.listFiles);
router.delete('/delete/:fileId', auth, fileController.deleteFile);

// New ZK-BitTorrent routes
router.post('/zk-peer-discovery', auth, zkTorrentController.initiateZKPeerDiscovery);
router.post('/zk-verify-peer', auth, zkTorrentController.verifyZKPeer);
router.post('/zk-create-info-hash', auth, zkTorrentController.createZKInfoHash);
router.post('/zk-verify-info-hash', auth, zkTorrentController.verifyZKInfoHash);
router.post('/zk-generate-piece-proof', auth, zkTorrentController.generateZKPieceProof);
router.post('/zk-verify-piece', auth, zkTorrentController.verifyZKPiece);
router.post('/zk-encrypt-message', auth, zkTorrentController.encryptPeerMessage);
router.post('/zk-decrypt-message', auth, zkTorrentController.decryptPeerMessage);
router.get('/zk-generate-dh-key-pair', auth, zkTorrentController.generateDHKeyPair);
router.post('/zk-compute-shared-secret', auth, zkTorrentController.computeSharedSecret);

// New ZK-BitTorrent specific file operations
router.post('/zk-upload', auth, async (req, res) => {
    try {
        // Generate ZK proof for the file
        const { fileHash, fileData } = req.body;
        const { proof, publicSignals } = await zkTorrentController.zkTorrentService.generatePieceVerificationProof(fileHash, fileData);

        // Encrypt the file data
        const encryptedData = await zkTorrentController.privacyTools.encryptPeerMessage(fileData, req.user.sharedSecret);

        // Upload the encrypted file with ZK proof
        const result = await fileController.uploadEncryptedFile(req.user.id, encryptedData, proof, publicSignals);

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload file with ZK proof' });
    }
});

router.get('/zk-download/:fileId', auth, async (req, res) => {
    try {
        // Retrieve the encrypted file and ZK proof
        const { encryptedData, proof, publicSignals } = await fileController.getEncryptedFile(req.params.fileId);

        // Verify the ZK proof
        const isValid = await zkTorrentController.zkTorrentService.verifyPieceVerificationProof(proof, publicSignals);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid ZK proof for file' });
        }

        // Decrypt the file data
        const decryptedData = zkTorrentController.privacyTools.decryptPeerMessage(encryptedData, req.user.sharedSecret);

        res.json({ fileData: decryptedData });
    } catch (error) {
        res.status(500).json({ error: 'Failed to download file with ZK verification' });
    }
});

module.exports = router;