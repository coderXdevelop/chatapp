import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MediaCategory = 'images' | 'videos' | 'audio' | 'documents' | 'cache';

export interface CategoryUsage {
  bytes: number;
  count: number;
}

export interface StorageUsageResult {
  categories: {
    images: CategoryUsage;
    videos: CategoryUsage;
    audio: CategoryUsage;
    documents: CategoryUsage;
    cache: CategoryUsage;
  };
  totalBytes: number;
  totalCount: number;
  formattedTotal: string;
}

export interface AutoCleanupSettings {
  enabled: boolean;
  retentionDays: number; // 7, 14, 30, 90, 365
  maxStorageMB: number; // 256, 512, 1024, 2048, 0 (unlimited)
}

const SETTINGS_KEY = '@chatconnect_storage_cleanup_settings';

const DEFAULT_SETTINGS: AutoCleanupSettings = {
  enabled: true,
  retentionDays: 30,
  maxStorageMB: 1024,
};

const BASE_DIR = `${FileSystem.documentDirectory}ChatAppMedia/`;

const CATEGORY_FOLDERS: Record<MediaCategory, string> = {
  images: `${BASE_DIR}images/`,
  videos: `${BASE_DIR}videos/`,
  audio: `${BASE_DIR}audio/`,
  documents: `${BASE_DIR}documents/`,
  cache: `${FileSystem.cacheDirectory || BASE_DIR + 'cache/'}app_cache/`,
};

/**
 * Initializes the ChatAppMedia directory structure if it doesn't exist.
 */
export async function initStorageDirectories(): Promise<void> {
  try {
    for (const folderPath of Object.values(CATEGORY_FOLDERS)) {
      const info = await FileSystem.getInfoAsync(folderPath);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
      }
    }
  } catch (error) {
    console.error('Failed to initialize storage directories:', error);
  }
}

/**
 * Gets destination path for a given category.
 */
export function getCategoryPath(category: MediaCategory, filename?: string): string {
  const folder = CATEGORY_FOLDERS[category] || CATEGORY_FOLDERS.cache;
  if (!filename) return folder;
  return `${folder}${filename}`;
}

/**
 * Calculates storage size recursively for a directory.
 */
async function getDirectorySize(dirPath: string): Promise<CategoryUsage> {
  let totalBytes = 0;
  let fileCount = 0;

  try {
    const info = await FileSystem.getInfoAsync(dirPath);
    if (!info.exists || !info.isDirectory) {
      return { bytes: 0, count: 0 };
    }

    const files = await FileSystem.readDirectoryAsync(dirPath);
    for (const file of files) {
      const filePath = `${dirPath}${file}`;
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        if (fileInfo.isDirectory) {
          const sub = await getDirectorySize(`${filePath}/`);
          totalBytes += sub.bytes;
          fileCount += sub.count;
        } else {
          totalBytes += fileInfo.size || 0;
          fileCount += 1;
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory size for ${dirPath}:`, error);
  }

  return { bytes: totalBytes, count: fileCount };
}

/**
 * Also scans flat legacy media files in FileSystem.documentDirectory root for backwards compatibility.
 */
async function getLegacyRootMediaSize(): Promise<{ images: CategoryUsage; videos: CategoryUsage; audio: CategoryUsage; documents: CategoryUsage }> {
  const usage = {
    images: { bytes: 0, count: 0 },
    videos: { bytes: 0, count: 0 },
    audio: { bytes: 0, count: 0 },
    documents: { bytes: 0, count: 0 },
  };

  try {
    const rootPath = FileSystem.documentDirectory;
    if (!rootPath) return usage;

    const files = await FileSystem.readDirectoryAsync(rootPath);
    for (const file of files) {
      if (file === 'ChatAppMedia' || file === 'RCTAsyncLocalStorage') continue;

      const filePath = `${rootPath}${file}`;
      const info = await FileSystem.getInfoAsync(filePath);
      if (info.exists && !info.isDirectory) {
        const size = info.size || 0;
        const ext = file.split('.').pop()?.toLowerCase() || '';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || file.startsWith('media_')) {
          if (ext === 'mp4' || ext === 'mov') {
            usage.videos.bytes += size;
            usage.videos.count += 1;
          } else if (ext === 'm4a' || ext === 'mp3' || ext === 'wav' || ext === 'aac') {
            usage.audio.bytes += size;
            usage.audio.count += 1;
          } else {
            usage.images.bytes += size;
            usage.images.count += 1;
          }
        } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'].includes(ext) || file.startsWith('doc_')) {
          usage.documents.bytes += size;
          usage.documents.count += 1;
        }
      }
    }
  } catch (error) {
    console.error('Error scanning root legacy media:', error);
  }

  return usage;
}

/**
 * Calculates current app storage usage by category.
 */
export async function getStorageUsage(): Promise<StorageUsageResult> {
  await initStorageDirectories();

  const [imagesUsage, videosUsage, audioUsage, docsUsage, cacheUsage, legacyUsage] = await Promise.all([
    getDirectorySize(CATEGORY_FOLDERS.images),
    getDirectorySize(CATEGORY_FOLDERS.videos),
    getDirectorySize(CATEGORY_FOLDERS.audio),
    getDirectorySize(CATEGORY_FOLDERS.documents),
    getDirectorySize(CATEGORY_FOLDERS.cache),
    getLegacyRootMediaSize(),
  ]);

  const categories = {
    images: {
      bytes: imagesUsage.bytes + legacyUsage.images.bytes,
      count: imagesUsage.count + legacyUsage.images.count,
    },
    videos: {
      bytes: videosUsage.bytes + legacyUsage.videos.bytes,
      count: videosUsage.count + legacyUsage.videos.count,
    },
    audio: {
      bytes: audioUsage.bytes + legacyUsage.audio.bytes,
      count: audioUsage.count + legacyUsage.audio.count,
    },
    documents: {
      bytes: docsUsage.bytes + legacyUsage.documents.bytes,
      count: docsUsage.count + legacyUsage.documents.count,
    },
    cache: {
      bytes: cacheUsage.bytes,
      count: cacheUsage.count,
    },
  };

  const totalBytes =
    categories.images.bytes +
    categories.videos.bytes +
    categories.audio.bytes +
    categories.documents.bytes +
    categories.cache.bytes;

  const totalCount =
    categories.images.count +
    categories.videos.count +
    categories.audio.count +
    categories.documents.count +
    categories.cache.count;

  return {
    categories,
    totalBytes,
    totalCount,
    formattedTotal: formatBytes(totalBytes),
  };
}

/**
 * Clears app temporary cache and expo-image disk & memory cache.
 */
export async function clearAppCache(): Promise<boolean> {
  try {
    // Clear expo-image cache
    await Image.clearDiskCache();
    await Image.clearMemoryCache();

    // Clear app cache directory
    const cacheDir = CATEGORY_FOLDERS.cache;
    const info = await FileSystem.getInfoAsync(cacheDir);
    if (info.exists) {
      await FileSystem.deleteAsync(cacheDir, { idempotent: true });
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }
    return true;
  } catch (error) {
    console.error('Failed to clear app cache:', error);
    return false;
  }
}

/**
 * Deletes media files by specific category or 'all'.
 */
export async function deleteMediaCategory(category: MediaCategory | 'all'): Promise<boolean> {
  try {
    if (category === 'all') {
      for (const cat of ['images', 'videos', 'audio', 'documents'] as MediaCategory[]) {
        await deleteMediaCategory(cat);
      }
      await deleteLegacyRootMedia();
      return true;
    }

    const folder = CATEGORY_FOLDERS[category];
    const info = await FileSystem.getInfoAsync(folder);
    if (info.exists) {
      await FileSystem.deleteAsync(folder, { idempotent: true });
      await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
    }

    if (category === 'images' || category === 'videos' || category === 'audio' || category === 'documents') {
      await deleteLegacyRootMedia(category);
    }

    return true;
  } catch (error) {
    console.error(`Failed to delete media for category ${category}:`, error);
    return false;
  }
}

/**
 * Deletes legacy media flat files in FileSystem.documentDirectory root.
 */
async function deleteLegacyRootMedia(targetCategory?: MediaCategory): Promise<void> {
  try {
    const rootPath = FileSystem.documentDirectory;
    if (!rootPath) return;

    const files = await FileSystem.readDirectoryAsync(rootPath);
    for (const file of files) {
      if (file === 'ChatAppMedia' || file === 'RCTAsyncLocalStorage') continue;

      const filePath = `${rootPath}${file}`;
      const ext = file.split('.').pop()?.toLowerCase() || '';
      const isMedia = file.startsWith('media_') || ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'm4a', 'mp3', 'wav'].includes(ext);
      const isDoc = file.startsWith('doc_') || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'].includes(ext);

      let shouldDelete = false;
      if (!targetCategory) {
        shouldDelete = isMedia || isDoc;
      } else if (targetCategory === 'images' && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        shouldDelete = true;
      } else if (targetCategory === 'videos' && ['mp4', 'mov'].includes(ext)) {
        shouldDelete = true;
      } else if (targetCategory === 'audio' && ['m4a', 'mp3', 'wav', 'aac'].includes(ext)) {
        shouldDelete = true;
      } else if (targetCategory === 'documents' && isDoc) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    }
  } catch (error) {
    console.error('Error deleting legacy root media:', error);
  }
}

/**
 * Fetches auto-cleanup settings.
 */
export async function getAutoCleanupSettings(): Promise<AutoCleanupSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (error) {
    console.error('Failed to read auto cleanup settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Saves auto-cleanup settings.
 */
export async function saveAutoCleanupSettings(settings: AutoCleanupSettings): Promise<boolean> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Failed to save auto cleanup settings:', error);
    return false;
  }
}

/**
 * Executes auto-cleanup based on age retention and storage size limit.
 */
export async function runAutoCleanup(): Promise<{ deletedCount: number; deletedBytes: number }> {
  let deletedCount = 0;
  let deletedBytes = 0;

  try {
    const settings = await getAutoCleanupSettings();
    if (!settings.enabled) return { deletedCount: 0, deletedBytes: 0 };

    const now = Date.now();
    const maxAgeMs = settings.retentionDays * 24 * 60 * 60 * 1000;
    const mediaCategories: MediaCategory[] = ['images', 'videos', 'audio', 'documents', 'cache'];

    const fileEntries: { path: string; modificationTime: number; size: number }[] = [];

    // Collect all media file metadata across categories
    for (const cat of mediaCategories) {
      const folder = CATEGORY_FOLDERS[cat];
      const info = await FileSystem.getInfoAsync(folder);
      if (!info.exists || !info.isDirectory) continue;

      const files = await FileSystem.readDirectoryAsync(folder);
      for (const file of files) {
        const filePath = `${folder}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists && !fileInfo.isDirectory) {
          const modTime = fileInfo.modificationTime ? fileInfo.modificationTime * 1000 : now;
          fileEntries.push({
            path: filePath,
            modificationTime: modTime,
            size: fileInfo.size || 0,
          });
        }
      }
    }

    // 1. Delete files older than retentionDays
    for (const entry of fileEntries) {
      if (now - entry.modificationTime > maxAgeMs) {
        try {
          await FileSystem.deleteAsync(entry.path, { idempotent: true });
          deletedCount += 1;
          deletedBytes += entry.size;
        } catch (e) {
          console.warn(`Failed to delete old file ${entry.path}:`, e);
        }
      }
    }

    // 2. Enforce maxStorageMB limit if set (> 0)
    if (settings.maxStorageMB > 0) {
      const maxSizeBytes = settings.maxStorageMB * 1024 * 1024;
      const currentUsage = await getStorageUsage();

      if (currentUsage.totalBytes > maxSizeBytes) {
        // Sort remaining files by modification time (oldest first)
        const remainingFiles: { path: string; modificationTime: number; size: number }[] = [];
        for (const cat of mediaCategories) {
          const folder = CATEGORY_FOLDERS[cat];
          const info = await FileSystem.getInfoAsync(folder);
          if (!info.exists || !info.isDirectory) continue;

          const files = await FileSystem.readDirectoryAsync(folder);
          for (const file of files) {
            const filePath = `${folder}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            if (fileInfo.exists && !fileInfo.isDirectory) {
              remainingFiles.push({
                path: filePath,
                modificationTime: fileInfo.modificationTime ? fileInfo.modificationTime * 1000 : now,
                size: fileInfo.size || 0,
              });
            }
          }
        }

        remainingFiles.sort((a, b) => a.modificationTime - b.modificationTime);

        let activeTotal = currentUsage.totalBytes;
        for (const file of remainingFiles) {
          if (activeTotal <= maxSizeBytes) break;
          try {
            await FileSystem.deleteAsync(file.path, { idempotent: true });
            activeTotal -= file.size;
            deletedCount += 1;
            deletedBytes += file.size;
          } catch (e) {
            console.warn(`Failed to delete overflow file ${file.path}:`, e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Auto cleanup error:', error);
  }

  return { deletedCount, deletedBytes };
}

/**
 * Utility to format byte count into human readable units.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
