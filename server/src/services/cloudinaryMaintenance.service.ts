import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import {
  deleteMediaAsset,
  listCloudinaryFolderResources,
  getCloudinaryAccountUsage,
} from './cloudinary.service.js';

export interface MaintenanceReport {
  timestamp: string;
  deletedSoftMessages: number;
  deletedOrphanedAssets: number;
  deletedAgedAssets: number;
  freedBytes: number;
  formattedFreedBytes: string;
  errors: string[];
}

/**
 * Format bytes into human readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 1. Purges media files attached to soft-deleted messages or deleted chats.
 */
export async function purgeDeletedMessageMedia(): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;

  try {
    // Find messages marked as deleted that still have media references
    const deletedMessages = await Message.find({
      isDeleted: true,
      mediaPublicId: { $ne: null, $exists: true },
    }).select('_id mediaPublicId mediaType');

    for (const msg of deletedMessages) {
      if (msg.mediaPublicId) {
        const rType = msg.mediaType === 'video' ? 'video' : msg.mediaType === 'document' ? 'raw' : 'image';
        const ok = await deleteMediaAsset(msg.mediaPublicId, rType);
        if (ok) {
          count += 1;
          (msg as any).mediaPublicId = undefined;
          (msg as any).mediaUrl = undefined;
          await msg.save();
        }
      }
    }
  } catch (error: any) {
    console.error('[CloudinaryMaintenance] Error in purgeDeletedMessageMedia:', error?.message || error);
  }

  return { count, bytes };
}

/**
 * 2. Scans Cloudinary for assets under 'chatconnect/' and deletes any file not present in MongoDB Users, Chats, or Messages.
 */
export async function purgeOrphanedCloudinaryAssets(): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;

  try {
    // Collect all active public IDs from MongoDB
    const [users, chats, messages] = await Promise.all([
      User.find({ avatarPublicId: { $ne: '', $exists: true } }).select('avatarPublicId'),
      Chat.find({ avatarPublicId: { $ne: '', $exists: true } }).select('avatarPublicId'),
      Message.find({ mediaPublicId: { $ne: null, $exists: true } }).select('mediaPublicId'),
    ]);

    const activePublicIds = new Set<string>();
    users.forEach((u) => u.avatarPublicId && activePublicIds.add(u.avatarPublicId));
    chats.forEach((c) => c.avatarPublicId && activePublicIds.add(c.avatarPublicId));
    messages.forEach((m) => m.mediaPublicId && activePublicIds.add(m.mediaPublicId));

    // Fetch all resources currently stored on Cloudinary under chatconnect/
    const remoteAssets = await listCloudinaryFolderResources('chatconnect/', 1000);

    for (const asset of remoteAssets) {
      if (!activePublicIds.has(asset.public_id)) {
        // Asset exists on Cloudinary but is not referenced in MongoDB -> Orphaned!
        const rType = asset.resource_type as 'image' | 'video' | 'raw';
        const ok = await deleteMediaAsset(asset.public_id, rType);
        if (ok) {
          count += 1;
          bytes += asset.bytes || 0;
          console.log(`[CloudinaryMaintenance] Purged orphaned asset: ${asset.public_id} (${formatBytes(asset.bytes)})`);
        }
      }
    }
  } catch (error: any) {
    console.error('[CloudinaryMaintenance] Error in purgeOrphanedCloudinaryAssets:', error?.message || error);
  }

  return { count, bytes };
}

/**
 * 3. Enforces media retention policy: Purges heavy media files older than daysThreshold (default 60 days) from Cloudinary.
 * Chat text remains intact in MongoDB; only heavy remote media files are deleted to guarantee staying within 25 GB free tier.
 */
export async function runMediaRetentionCleanup(daysThreshold: number = 60): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;

  try {
    const cutoffDate = new Date(Date.now() - daysThreshold * 24 * 60 * 60 * 1000);

    // Find messages older than cutoffDate that still have media
    const expiredMessages = await Message.find({
      createdAt: { $lt: cutoffDate },
      mediaPublicId: { $ne: null, $exists: true },
    }).select('_id mediaPublicId mediaType mediaUrl createdAt');

    for (const msg of expiredMessages) {
      if (msg.mediaPublicId) {
        const rType = msg.mediaType === 'video' ? 'video' : msg.mediaType === 'document' ? 'raw' : 'image';
        const ok = await deleteMediaAsset(msg.mediaPublicId, rType);
        if (ok) {
          count += 1;
          // Retain message record, but clear heavy remote media references
          (msg as any).mediaPublicId = undefined;
          (msg as any).mediaUrl = undefined;
          await msg.save();
        }
      }
    }
  } catch (error: any) {
    console.error('[CloudinaryMaintenance] Error in runMediaRetentionCleanup:', error?.message || error);
  }

  return { count, bytes };
}

/**
 * 4. Runs full Cloudinary server-side maintenance sequence.
 */
export async function runFullCloudinaryMaintenance(retentionDays: number = 60): Promise<MaintenanceReport> {
  const errors: string[] = [];
  const startTime = new Date().toISOString();

  console.log(`[CloudinaryMaintenance] Starting automated maintenance at ${startTime}...`);

  let softRes = { count: 0, bytes: 0 };
  let orphanRes = { count: 0, bytes: 0 };
  let agedRes = { count: 0, bytes: 0 };

  try {
    softRes = await purgeDeletedMessageMedia();
  } catch (e: any) {
    errors.push(`Soft-delete purge error: ${e?.message || e}`);
  }

  try {
    orphanRes = await purgeOrphanedCloudinaryAssets();
  } catch (e: any) {
    errors.push(`Orphan purge error: ${e?.message || e}`);
  }

  try {
    agedRes = await runMediaRetentionCleanup(retentionDays);
  } catch (e: any) {
    errors.push(`Retention purge error: ${e?.message || e}`);
  }

  const totalFreedBytes = softRes.bytes + orphanRes.bytes + agedRes.bytes;

  const report: MaintenanceReport = {
    timestamp: startTime,
    deletedSoftMessages: softRes.count,
    deletedOrphanedAssets: orphanRes.count,
    deletedAgedAssets: agedRes.count,
    freedBytes: totalFreedBytes,
    formattedFreedBytes: formatBytes(totalFreedBytes),
    errors,
  };

  console.log(`[CloudinaryMaintenance] Maintenance complete. Report:`, report);
  return report;
}
