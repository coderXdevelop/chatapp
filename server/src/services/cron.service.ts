import { runFullCloudinaryMaintenance } from './cloudinaryMaintenance.service.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
let maintenanceTimer: NodeJS.Timeout | null = null;

/**
 * Initializes background scheduled maintenance tasks.
 */
export function initBackgroundCronServices(): void {
  console.log('[CronService] Initializing background storage maintenance jobs...');

  // Delay initial run by 30 seconds after server startup to avoid startup overhead
  setTimeout(() => {
    runFullCloudinaryMaintenance(60).catch((err) => {
      console.error('[CronService] Initial background maintenance error:', err);
    });
  }, 30000);

  // Set recurring timer for every 7 days
  maintenanceTimer = setInterval(() => {
    console.log('[CronService] Running scheduled weekly Cloudinary maintenance...');
    runFullCloudinaryMaintenance(60).catch((err) => {
      console.error('[CronService] Scheduled weekly maintenance error:', err);
    });
  }, SEVEN_DAYS_MS);
}

export function stopBackgroundCronServices(): void {
  if (maintenanceTimer) {
    clearInterval(maintenanceTimer);
    maintenanceTimer = null;
  }
}
