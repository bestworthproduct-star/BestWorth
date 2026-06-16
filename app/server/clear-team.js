const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const TeamMember = require('./models/TeamMember');

async function clearTeam() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/bestworth';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for team cleanup');

    const result = await TeamMember.deleteMany({});
    console.log(`Removed ${result.deletedCount} team members`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Failed to clear team members:', error);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

clearTeam();
