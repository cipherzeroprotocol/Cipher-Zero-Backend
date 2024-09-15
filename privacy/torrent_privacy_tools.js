const crypto = require('crypto');
const snarkjs = require('snarkjs');
const { Buffer } = require('buffer');
const ipaddr = require('ipaddr.js');

const LOGGER = require('log4js').getLogger('torrent_privacy_tools.js');

class TorrentPrivacyTools {
    constructor(options = {}) {
        this.circuitPath = options.circuitPath || './zk-circuits';
        this.infoHashMaskingWasm = options.infoHashMaskingWasm || 'info-hash-masking.wasm';
        this.infoHashMaskingZkey = options.infoHashMaskingZkey || 'info-hash-masking.zkey';
    }

    async initialize() {
        this.infoHashMaskingVKey = await this.loadVerificationKey(this.infoHashMaskingZkey);
    }

    async loadVerificationKey(zkeyFileName) {
        const zkeyPath = path.join(this.circuitPath, zkeyFileName);
        return snarkjs.zKey.exportVerificationKey(zkeyPath);
    }

    generatePseudonymousId() {
        return crypto.randomBytes(20).toString('hex');
    }

    async maskInfoHash(infoHash) {
        const input = { infoHash: BigInt('0x' + infoHash) };
        try {
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                path.join(this.circuitPath, this.infoHashMaskingWasm),
                path.join(this.circuitPath, this.infoHashMaskingZkey)
            );
            return { maskedInfoHash: publicSignals[0], proof };
        } catch (error) {
            LOGGER.error('Failed to mask info hash:', error);
            throw error;
        }
    }

    async verifyMaskedInfoHash(maskedInfoHash, proof) {
        try {
            return await snarkjs.groth16.verify(this.infoHashMaskingVKey, [maskedInfoHash], proof);
        } catch (error) {
            LOGGER.error('Failed to verify masked info hash:', error);
            return false;
        }
    }

    obfuscateAnnounce(announce, infoHash) {
        const obfuscatedAnnounce = new URL(announce);
        obfuscatedAnnounce.searchParams.set('info_hash', this.xorInfoHash(infoHash));
        return obfuscatedAnnounce.toString();
    }

    xorInfoHash(infoHash) {
        const key = crypto.randomBytes(20);
        const xoredHash = Buffer.from(infoHash, 'hex').map((byte, i) => byte ^ key[i]);
        return xoredHash.toString('hex');
    }

    obfuscateIp(ip) {
        const addr = ipaddr.parse(ip);
        if (addr.kind() === 'ipv4') {
            // Obfuscate last octet for IPv4
            const octets = addr.octets();
            octets[3] = Math.floor(Math.random() * 256);
            return ipaddr.fromByteArray(octets).toString();
        } else {
            // Obfuscate last 64 bits for IPv6
            const parts = addr.parts;
            parts[6] = Math.floor(Math.random() * 65536);
            parts[7] = Math.floor(Math.random() * 65536);
            return ipaddr.fromByteArray(parts).toString();
        }
    }

    encryptPeerMessage(message, sharedSecret) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret, iv);
        let encrypted = cipher.update(message, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return { encrypted, iv: iv.toString('hex'), authTag: authTag.toString('hex') };
    }

    decryptPeerMessage(encryptedMessage, sharedSecret) {
        const decipher = crypto.createDecipheriv('aes-256-gcm', sharedSecret, Buffer.from(encryptedMessage.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(encryptedMessage.authTag, 'hex'));
        let decrypted = decipher.update(encryptedMessage.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }

    generateDHKeyPair() {
        return crypto.generateKeyPairSync('dh', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
        });
    }

    computeSharedSecret(privateKey, otherPublicKey) {
        const ecdh = crypto.createECDH('secp256k1');
        ecdh.setPrivateKey(privateKey, 'hex');
        return ecdh.computeSecret(otherPublicKey, 'hex', 'hex');
    }

    padPieceData(pieceData, targetSize) {
        const paddingSize = targetSize - pieceData.length;
        if (paddingSize <= 0) return pieceData;
        const padding = crypto.randomBytes(paddingSize);
        return Buffer.concat([pieceData, padding]);
    }

    generatePlausibleDeniabilityPieces(numPieces) {
        return Array(numPieces).fill().map(() => crypto.randomBytes(16384)); // Assuming 16KB pieces
    }
}

module.exports = TorrentPrivacyTools;