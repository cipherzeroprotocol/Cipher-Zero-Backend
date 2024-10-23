// CipherTorrent/lib/config/init.js
const path = require('path');
const fs = require('fs');

class Config {
  constructor() {
    this.config = {
      port: 6881,
      dht_port: 20001,
      announce_interval: 900,
      peer_max_connections: 50,
      download_path: path.join(__dirname, '../downloads'),
    };

    this.loadConfig();
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '../../config/config.cfg');
      if (fs.existsSync(configPath)) {
        const configFile = fs.readFileSync(configPath, 'utf8');
        const configLines = configFile.split('\n');
        
        configLines.forEach(line => {
          const [key, value] = line.split('=');
          if (key && value) {
            this.config[key.trim()] = value.trim();
          }
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  get(key) {
    return this.config[key];
  }
}

module.exports = new Config();