const mongoose = require('mongoose');
const { setDatabaseAvailable, setLastDatabaseError } = require('../utils/db-state');

const DEFAULT_LOCAL_URI = 'mongodb://localhost:27017/bestworth';

const connectDB = async () => {
  const primaryUri = process.env.MONGODB_URI;
  const fallbackUri = process.env.LOCAL_MONGODB_URI || DEFAULT_LOCAL_URI;
  const isProduction = process.env.NODE_ENV === 'production';
  const shouldExitOnFailure = process.env.EXIT_ON_DB_FAILURE === 'true';

  if (!primaryUri && !fallbackUri) {
    console.error('No MongoDB connection string is configured.');
    setDatabaseAvailable(false);
    setLastDatabaseError(new Error('No MongoDB connection string is configured.'));
    if (shouldExitOnFailure) {
      process.exit(1);
    }
    return false;
  }

  try {
    const conn = await mongoose.connect(primaryUri || fallbackUri);
    setDatabaseAvailable(true);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (primaryError) {
    setDatabaseAvailable(false);
    setLastDatabaseError(primaryError);
    if (!primaryUri || isProduction) {
      console.error(`Error: ${primaryError.message}`);
      if (shouldExitOnFailure) {
        process.exit(1);
      }
      return false;
    }

    console.warn(`Primary MongoDB failed, falling back to local MongoDB: ${primaryError.message}`);

    try {
      const conn = await mongoose.connect(fallbackUri);
      setDatabaseAvailable(true);
      console.log(`MongoDB Connected (fallback): ${conn.connection.host}`);
      return true;
    } catch (fallbackError) {
      setDatabaseAvailable(false);
      setLastDatabaseError(fallbackError);
      console.error(`Error: ${fallbackError.message}`);
      if (shouldExitOnFailure) {
        process.exit(1);
      }
      return false;
    }
  }
};

module.exports = connectDB;
