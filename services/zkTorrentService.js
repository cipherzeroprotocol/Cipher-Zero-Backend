const snarkjs = require('snarkjs');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const LOGGER = require('log4js').getLogger('zkTorrentService.js');

class ZKTorrentService {
    constructor(options = {}) {
        this.circuitPath = options.circuitPath || path.join(__dirname, '../zk-circuits');
        this.peerDiscoveryWasm = options.peerDiscoveryWasm || 'peer-discovery.wasm';
        this.peerDiscoveryZkey = options.peerDiscoveryZkey || 'peer-discovery.zkey';
        this.pieceVerificationWasm = options.pieceVerificationWasm || 'piece-verification.wasm';
        this.pieceVerificationZkey = options.pieceVerificationZkey || 'piece-verification.zkey';
        this.dataProofWasm = 'data-proof.wasm';
        this.dataProofZkey = 'data-proof.zkey';
        this.compressionProofWasm = 'compression-proof.wasm';
        this.compressionProofZkey = 'compression-proof.zkey';
        
        this.dht = new PrivacyDHT();
        this.fileProcessor = new FileProcessor();
        this.magnetLinkGenerator = new MagnetLinkGenerator();
    }

    async initialize() {
        this.peerDiscoveryVKey = await this.loadVerificationKey(this.peerDiscoveryZkey);
        this.pieceVerificationVKey = await this.loadVerificationKey(this.pieceVerificationZkey);
        this.dataProofVKey = await this.loadVerificationKey(this.dataProofZkey);
        this.compressionVKey = await this.loadVerificationKey(this.compressionProofZkey);
    }

    async loadVerificationKey(zkeyFileName) {
        const zkeyPath = path.join(this.circuitPath, zkeyFileName);
        return snarkjs.zKey.exportVerificationKey(zkeyPath);
    }

    async createTorrent(file, privateData) {
        const torrent = new ZkEnhancedTorrent(file, privateData);
        const { torrentData, proof, publicSignals } = await torrent.createZkTorrent();
        await this.dht.put(torrentData.infoHash, { proof, publicSignals });
        return torrentData;
    }
    
    async downloadTorrent(infoHash) {
        const { proof, publicSignals } = await this.dht.get(infoHash);
        const torrent = new ZkEnhancedTorrent(infoHash);
        const isValid = await torrent.verifyZkTorrent(proof, publicSignals);
        if (!isValid) throw new Error('Invalid torrent');
        return torrent;
    }

    async generatePeerDiscoveryProof(peerId, ip, port) {
        const peerIdHash = this.hash(peerId);
        const addressHash = this.hash(`${ip}:${port}`);
        const input = { peerIdHash, addressHash };

        try {
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                path.join(this.circuitPath, this.peerDiscoveryWasm),
                path.join(this.circuitPath, this.peerDiscoveryZkey)
            );
            return { proof, publicSignals };
        } catch (error) {
            LOGGER.error('Failed to generate peer discovery proof:', error);
            throw error;
        }
    }

    async verifyPeerDiscoveryProof(proof, publicSignals) {
        try {
            return await snarkjs.groth16.verify(this.peerDiscoveryVKey, publicSignals, proof);
        } catch (error) {
            LOGGER.error('Failed to verify peer discovery proof:', error);
            return false;
        }
    }

    async generatePieceVerificationProof(pieceHash, pieceData) {
        const input = { pieceHash: this.hash(pieceHash), pieceDataHash: this.hash(pieceData) };

        try {
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                path.join(this.circuitPath, this.pieceVerificationWasm),
                path.join(this.circuitPath, this.pieceVerificationZkey)
            );
            return { proof, publicSignals };
        } catch (error) {
            LOGGER.error('Failed to generate piece verification proof:', error);
            throw error;
        }
    }

    async verifyPieceVerificationProof(proof, publicSignals) {
        try {
            return await snarkjs.groth16.verify(this.pieceVerificationVKey, publicSignals, proof);
        } catch (error) {
            LOGGER.error('Failed to verify piece verification proof:', error);
            return false;
        }
    }

    hash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    async transferData(data, recipient) {
        const dataType = this.getDataType(data);
        const processedData = await this.processData(data, dataType);
        
        const { proof, publicSignals } = await this.generateProof(processedData, dataType);
        
        const torrent = await this.createTorrent(processedData, { proof, publicSignals });
        await this.dht.put(torrent.infoHash, { proof, publicSignals });
        
        const magnetLink = this.magnetLinkGenerator.generate(torrent);
        
        if (dataType === 'file' || dataType === 'message') {
            await this.storeMetadataOnChain(torrent.infoHash, recipient, dataType);
        }
        
        if (dataType === 'coin') {
            await this.initiateCoinTransfer(data.amount, recipient);
        }
        
        await this.notifyRecipient(recipient, magnetLink, dataType);
        
        return { magnetLink, infoHash: torrent.infoHash, dataType, recipient };
    }
    
    getDataType(data) {
        if (data instanceof Buffer || data instanceof Blob) return 'file';
        if (typeof data === 'string') return 'message';
        if (typeof data === 'object' && data.amount) return 'coin';
        throw new Error('Unsupported data type');
    }
    
    async processData(data, dataType) {
        switch (dataType) {
            case 'file':
                return await this.fileProcessor.process(data);
            case 'message':
                return this.encryptMessage(data);
            case 'coin':
                return this.prepareCoinTransferData(data);
            default:
                throw new Error('Unsupported data type');
        }
    }
    
    encryptMessage(message) {
        const iv = crypto.randomBytes(16);
        const key = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY, 'hex');
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(message, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return { encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') };
    }
    
    prepareCoinTransferData(data) {
        return {
            amount: data.amount,
            timestamp: Date.now(),
            nonce: crypto.randomBytes(16).toString('hex')
        };
    }
    
    async storeMetadataOnChain(infoHash, recipient, dataType) {
        await ContractInteraction.storeMetadata(infoHash, recipient, dataType);
    }
    
    async initiateCoinTransfer(amount, recipient) {
        await ContractInteraction.transferCoins(amount, recipient);
    }
    
    async notifyRecipient(recipient, magnetLink, dataType) {
        console.log(`Notifying recipient ${recipient} about new ${dataType} transfer: ${magnetLink}`);
    }

    async generateProof(processedData, dataType) {
        const input = {
            data: this.hash(JSON.stringify(processedData)),
            dataType: this.hash(dataType)
        };
        
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            path.join(this.circuitPath, this.dataProofWasm),
            path.join(this.circuitPath, this.dataProofZkey)
        );
        
        return { proof, publicSignals };
    }

    async encryptPiece(piece, publicKey) {
        const symmetricKey = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', symmetricKey, iv);
        
        let encryptedPiece = cipher.update(piece);
        encryptedPiece = Buffer.concat([encryptedPiece, cipher.final()]);
        
        const authTag = cipher.getAuthTag();
        
        const encryptedKey = crypto.publicEncrypt(publicKey, symmetricKey);
        
        return {
            encryptedPiece,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            encryptedKey: encryptedKey.toString('hex')
        };
    }

    async decryptPiece(encryptedPieceData, privateKey) {
        const { encryptedPiece, iv, authTag, encryptedKey } = encryptedPieceData;
        
        const symmetricKey = crypto.privateDecrypt(privateKey, Buffer.from(encryptedKey, 'hex'));
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', symmetricKey, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));
        
        let decryptedPiece = decipher.update(encryptedPiece);
        decryptedPiece = Buffer.concat([decryptedPiece, decipher.final()]);
        
        return decryptedPiece;
    }

    async generateZKCompressedPiece(piece) {
        const compressedPiece = await this.compressPiece(piece);
        const input = {
            originalHash: this.hash(piece),
            compressedHash: this.hash(compressedPiece),
            compressionRatio: piece.length / compressedPiece.length
        };
        
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            input,
            path.join(this.circuitPath, this.compressionProofWasm),
            path.join(this.circuitPath, this.compressionProofZkey)
        );
        
        return { compressedPiece, proof, publicSignals };
    }

    async decompressZKPiece(compressedPieceData) {
        const { compressedPiece, proof, publicSignals } = compressedPieceData;
        
        const isValid = await snarkjs.groth16.verify(
            this.compressionVKey,
            publicSignals,
            proof
        );
        
        if (!isValid) {
            throw new Error('Invalid compression proof');
        }
        
        return await this.decompressPiece(compressedPiece);
    }

    async compressPiece(piece) {
        return zlib.deflateSync(piece);
    }

    async decompressPiece(compressedPiece) {
        return zlib.inflateSync(compressedPiece);
    }
}

module.exports = ZKTorrentService;