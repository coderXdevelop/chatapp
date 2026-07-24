import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';
import { api } from './api';

export interface UploadProgressCallback {
  (progress: number): void;
}

export const getCloudinarySignature = async () => {
  const response = await api.get('/api/media/cloudinary-signature');
  return response.data;
};

export const pickMedia = async (
  type: 'image' | 'video',
  allowsMultipleSelection = false
): Promise<ImagePicker.ImagePickerAsset[] | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    alert('Permission to access camera roll is required!');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: type === 'image' ? ['images'] : ['videos'],
    allowsMultipleSelection,
    allowsEditing: !allowsMultipleSelection && type === 'image',
    quality: 0.8,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
  });

  return result.canceled ? null : result.assets;
};

export const compressImage = async (uri: string): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (error) {
    console.error('Image compression failed, using original uri:', error);
    return uri;
  }
};

export const uploadToCloudinary = async (
  localUri: string,
  mimeType: string,
  signatureData: { signature: string; timestamp: number; apiKey: string; cloudName: string; folder: string },
  onProgress: UploadProgressCallback
): Promise<string> => {
  const formData = new FormData();
  
  formData.append('file', {
    uri: localUri,
    type: mimeType || 'image/jpeg',
    name: localUri.split('/').pop() || 'upload.jpg',
  } as any);

  formData.append('api_key', signatureData.apiKey);
  formData.append('timestamp', signatureData.timestamp.toString());
  formData.append('signature', signatureData.signature);
  formData.append('folder', signatureData.folder);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    }
  );

  return response.data.secure_url;
};
