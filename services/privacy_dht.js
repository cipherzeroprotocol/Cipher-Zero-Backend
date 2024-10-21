// privacy_dht.js
const DHT = require('bittorrent-dht');
const { generateProof, verifyProof } = require('./zksnark/client');

class PrivacyDHT extends DHT {
  constructor(options) {
    super(options);
  }

  async put(key, value) {
    const { proof, publicSignals } = await generateProof(value);
    return super.put(key, { value, proof, publicSignals });
  }

  async get(key) {
    const result = await super.get(key);
    if (!result) return null;

    const { value, proof, publicSignals } = result;
    const isValid = await verifyProof(proof, publicSignals);
    return isValid ? value : null;
  }
}

module.exports = PrivacyDHT;