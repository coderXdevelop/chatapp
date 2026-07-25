import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';

export const getMimeTypeFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'doc':
    case 'docx':
      return 'application/msword';
    case 'xls':
    case 'xlsx':
      return 'application/vnd.ms-excel';
    case 'ppt':
    case 'pptx':
      return 'application/vnd.ms-powerpoint';
    case 'txt':
      return 'text/plain';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'mp4':
      return 'video/mp4';
    case 'mp3':
    case 'm4a':
      return 'audio/mpeg';
    case 'zip':
      return 'application/zip';
    default:
      return 'application/octet-stream';
  }
};

export const openDocumentFile = async (
  url: string,
  filename?: string,
  providedMimeType?: string
): Promise<void> => {
  try {
    let localUri = url;

    // Check if remote URL; if so, download to local cache
    if (!url.startsWith('file://') && !url.startsWith('content://')) {
      const safeFilename = filename || `doc_${Date.now()}.${url.split('.').pop()?.split('?')[0] || 'pdf'}`;
      const cachePath = `${FileSystem.documentDirectory}${safeFilename}`;
      const info = await FileSystem.getInfoAsync(cachePath);

      if (!info.exists) {
        const downloadResult = await FileSystem.downloadAsync(url, cachePath);
        localUri = downloadResult.uri;
      } else {
        localUri = cachePath;
      }
    }

    const mimeType = providedMimeType || getMimeTypeFromExtension(filename || localUri);

    // Try Android IntentLauncher first if on Android
    if (Platform.OS === 'android') {
      try {
        const IntentLauncher = require('expo-intent-launcher');
        if (IntentLauncher) {
          const contentUri = await FileSystem.getContentUriAsync(localUri);
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            type: mimeType,
            flags: 1, // Intent.FLAG_GRANT_READ_URI_PERMISSION
          });
          return;
        }
      } catch (intentErr) {
        console.warn('IntentLauncher failed or not supported, falling back to Sharing/Linking:', intentErr);
      }
    }

    // Fallback: use Expo Sharing or Linking
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localUri, { mimeType, dialogTitle: filename || 'Open Document' });
    } else {
      await Linking.openURL(localUri);
    }
  } catch (error: any) {
    console.error('Failed to open document:', error);
    Alert.alert('Error', error.message || 'Could not open document in a supported app.');
  }
};
