import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runFullCloudinaryMaintenance } from '../services/cloudinaryMaintenance.service.js';

dotenv.config();

export async function runStandaloneCloudinaryCleanup(): Promise<void> {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || '';
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is missing in environment variables (.env).');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB to check active media references...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    console.log('\n🧹 Starting Cloudinary cleanup & orphaned asset purging...');
    // retentionDays: default to 0 if full force cleanup desired or 60 for standard retention
    const retentionDaysArg = process.argv[2] ? parseInt(process.argv[2], 10) : 60;
    const report = await runFullCloudinaryMaintenance(retentionDaysArg);

    console.log('\n========================================');
    console.log('🎉 Cloudinary Cleanup Summary Report:');
    console.log('========================================');
    console.log(`• Soft-Deleted Messages Cleaned: ${report.deletedSoftMessages}`);
    console.log(`• Orphaned Assets Deleted:      ${report.deletedOrphanedAssets}`);
    console.log(`• Aged Assets Purged:           ${report.deletedAgedAssets}`);
    console.log(`• Total Freed Storage Space:     ${report.formattedFreedBytes}`);
    if (report.errors.length > 0) {
      console.log(`⚠️ Errors encountered during cleanup:`, report.errors);
    }
    console.log('========================================\n');

    await mongoose.disconnect();
    console.log('👋 MongoDB disconnected. Script finished successfully.');
  } catch (err: any) {
    console.error('❌ Error during Cloudinary cleanup script:', err?.message || err);
    process.exit(1);
  }
}

// Run standalone if invoked directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('cleanup-cloudinary.ts')) {
  runStandaloneCloudinaryCleanup();
}
