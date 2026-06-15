const mongoose = require('mongoose');

const DEFAULT_LOCAL_URI = 'mongodb://localhost:27017/bestworth';

const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI;
  const fallbackUri = process.env.LOCAL_MONGODB_URI || DEFAULT_LOCAL_URI;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!primaryUri && !fallbackUri) {
    console.error('No MongoDB connection string is configured.');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(primaryUri || fallbackUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (primaryError) {
    if (!primaryUri || isProduction) {
      console.error(`Error: ${primaryError.message}`);
      process.exit(1);
    }

    console.warn(`Primary MongoDB failed, falling back to local MongoDB: ${primaryError.message}`);

    try {
      const conn = await mongoose.connect(fallbackUri);
      console.log(`MongoDB Connected (fallback): ${conn.connection.host}`);
    } catch (fallbackError) {
      console.error(`Error: ${fallbackError.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
