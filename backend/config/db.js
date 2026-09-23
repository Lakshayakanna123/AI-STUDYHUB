const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/virtual-classroom';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.log(`Local MongoDB connection failed (${err.message}). Starting in-memory MongoDB...`);
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      let mongoServer;
      try {
        mongoServer = await MongoMemoryServer.create({ instance: { port: 27017, dbName: 'virtual-classroom' } });
      } catch (portErr) {
        mongoServer = await MongoMemoryServer.create();
      }
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      console.log(`In-Memory MongoDB connected successfully at ${uri}`);
    } catch (memErr) {
      console.error(`Failed to connect to Mongo or In-Memory Mongo: ${memErr.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;

