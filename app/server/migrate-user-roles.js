require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

async function migrate() {
  const connected = await connectDB();
  if (!connected) throw new Error('Could not connect to the database. No changes were made.');
  const legacyUsers = await User.find({ role: { $exists: false } });
  if (legacyUsers.length !== 1) {
    throw new Error(`Expected exactly one legacy owner account, found ${legacyUsers.length}. No changes were made.`);
  }

  const owner = legacyUsers[0];
  owner.role = 'admin';
  owner.active = true;
  owner.mustChangePassword = false;
  await owner.save();
  console.log(`Migrated ${owner.username} to the admin owner role.`);
  await mongoose.disconnect();
}

migrate().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
