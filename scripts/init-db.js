// scripts/init-db.js
const mongoose = require('mongoose');
require('dotenv').config();

const initializeDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Initialize collections
    const collections = [
      'files',
      'messages',
      'proofs',
      'tokens',
      'peers'
    ];

    for (const collection of collections) {
      await mongoose.connection.createCollection(collection);
      console.log(`Created collection: ${collection}`);
    }

    console.log('Database initialization complete');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
};

initializeDatabase();