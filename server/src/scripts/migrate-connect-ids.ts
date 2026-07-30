import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

export async function runLegacyUserMigration(): Promise<void> {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
  if (!mongoUri) {
    console.error('MONGO_URI is missing in environment variables.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for legacy user connectId migration...');

    // Batch query for unmigrated users only
    const legacyUsers = await User.find({ connectId: { $exists: false } }).limit(500);

    if (legacyUsers.length === 0) {
      console.log('No legacy users requiring connectId migration.');
      await mongoose.disconnect();
      return;
    }

    console.log(`Found ${legacyUsers.length} legacy users to migrate.`);
    let migratedCount = 0;

    for (const user of legacyUsers) {
      const parts = (user.email || '').split('@');
      const base = (parts[0] || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      let uniqueId = base;
      let collision = await User.findOne({ connectId: uniqueId });
      while (collision) {
        uniqueId = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
        collision = await User.findOne({ connectId: uniqueId });
      }
      user.connectId = uniqueId;
      await user.save();
      migratedCount += 1;
      console.log(`Migrated (${migratedCount}/${legacyUsers.length}): ${user.email} -> ${uniqueId}`);
    }

    console.log(`Legacy user migration complete. Total migrated: ${migratedCount}`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error during legacy user migration script:', err);
    process.exit(1);
  }
}

// Run standalone if invoked directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate-connect-ids.ts')) {
  runLegacyUserMigration();
}
