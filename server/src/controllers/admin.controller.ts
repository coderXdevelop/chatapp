import type { Request, Response } from 'express';
import { getCloudinaryAccountUsage } from '../services/cloudinary.service.js';
import { runFullCloudinaryMaintenance } from '../services/cloudinaryMaintenance.service.js';

/**
 * GET /api/admin/cloudinary-status
 * Fetch Cloudinary account storage usage metrics, transformation credits, and health.
 */
export async function getCloudinaryStatus(req: Request, res: Response): Promise<void> {
  try {
    const usage = await getCloudinaryAccountUsage();

    if (!usage) {
      res.status(500).json({
        success: false,
        message: 'Could not retrieve Cloudinary usage stats. Check API credentials.',
      });
      return;
    }

    const storageUsage = usage.storage || {};
    const bandwidthUsage = usage.bandwidth || {};
    const creditsUsage = usage.credits || {};

    res.json({
      success: true,
      data: {
        plan: usage.plan || 'Free',
        lastUpdated: new Date().toISOString(),
        storage: {
          usedBytes: storageUsage.usage || 0,
          limitBytes: storageUsage.limit || 26843545600, // 25 GB default free limit
          usedPercent: storageUsage.used_percent || 0,
        },
        bandwidth: {
          usedBytes: bandwidthUsage.usage || 0,
          limitBytes: bandwidthUsage.limit || 26843545600,
          usedPercent: bandwidthUsage.used_percent || 0,
        },
        credits: {
          used: creditsUsage.usage || 0,
          limit: creditsUsage.limit || 25,
          usedPercent: creditsUsage.used_percent || 0,
        },
        rawUsage: usage,
      },
    });
  } catch (error: any) {
    console.error('[AdminController] getCloudinaryStatus error:', error?.message || error);
    res.status(500).json({ success: false, message: error?.message || 'Failed to fetch status' });
  }
}

/**
 * POST /api/admin/cloudinary-cleanup
 * Manually trigger server-side Cloudinary garbage collection and maintenance.
 */
export async function triggerCloudinaryCleanup(req: Request, res: Response): Promise<void> {
  try {
    const daysThreshold = req.body?.retentionDays ? Number(req.body.retentionDays) : 60;
    const report = await runFullCloudinaryMaintenance(daysThreshold);

    res.json({
      success: true,
      message: 'Cloudinary maintenance execution complete.',
      report,
    });
  } catch (error: any) {
    console.error('[AdminController] triggerCloudinaryCleanup error:', error?.message || error);
    res.status(500).json({ success: false, message: error?.message || 'Maintenance execution failed' });
  }
}
