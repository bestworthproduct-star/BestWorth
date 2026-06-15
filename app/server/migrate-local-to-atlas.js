const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config();

const LOCAL_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017';
const REMOTE_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'bestworth';
const COLLECTIONS = ['users', 'products', 'teammembers', 'inquiries', 'contents'];

async function migrateCollection(sourceDb, targetDb, collectionName) {
  const sourceCollection = sourceDb.collection(collectionName);
  const targetCollection = targetDb.collection(collectionName);

  const documents = await sourceCollection.find({}).toArray();
  console.log(`${collectionName}: found ${documents.length} local documents`);

  if (documents.length === 0) {
    return;
  }

  const operations = documents.map((document) => ({
    replaceOne: {
      filter: { _id: document._id },
      replacement: document,
      upsert: true
    }
  }));

  const result = await targetCollection.bulkWrite(operations, { ordered: false });
  console.log(
    `${collectionName}: upserted ${result.upsertedCount}, modified ${result.modifiedCount}, matched ${result.matchedCount}`
  );
}

async function main() {
  if (!REMOTE_URI) {
    throw new Error('MONGODB_URI is required for Atlas migration.');
  }

  const localClient = new MongoClient(LOCAL_URI);
  const remoteClient = new MongoClient(REMOTE_URI);

  try {
    await localClient.connect();
    await remoteClient.connect();

    const sourceDb = localClient.db(DB_NAME);
    const targetDb = remoteClient.db(DB_NAME);

    console.log(`Migrating database "${DB_NAME}" from local MongoDB to Atlas...`);

    for (const collectionName of COLLECTIONS) {
      await migrateCollection(sourceDb, targetDb, collectionName);
    }

    console.log('Migration completed successfully.');
  } finally {
    await Promise.allSettled([localClient.close(), remoteClient.close()]);
  }
}

main().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
