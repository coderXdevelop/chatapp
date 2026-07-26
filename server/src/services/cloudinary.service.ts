import { v2 as cloudinary } from 'cloudinary';

function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
    api_key: process.env.CLOUDINARY_API_KEY || '',
    api_secret: process.env.CLOUDINARY_API_SECRET || '',
    secure: true,
  });
  return cloudinary;
}

export interface UploadMediaResult {
  url: string;
  publicId: string;
  bytes: number;
  format: string;
}

/**
 * Upload an avatar image (base64 data URI or image URL) to Cloudinary with auto-compression.
 */
export async function uploadAvatar(fileStr: string): Promise<UploadMediaResult> {
  try {
    const instance = getCloudinary();
    const uploadResponse = await instance.uploader.upload(fileStr, {
      folder: 'chatconnect/avatars',
      transformation: [
        { width: 800, height: 800, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ],
    });

    return {
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id,
      bytes: uploadResponse.bytes || 0,
      format: uploadResponse.format || '',
    };
  } catch (error: any) {
    console.error('[Cloudinary] uploadAvatar error:', error?.message || error);
    if (fileStr && (fileStr.startsWith('data:') || fileStr.startsWith('http'))) {
      console.warn('[Cloudinary] Falling back to direct image data URI due to Cloudinary API restriction.');
      return {
        url: fileStr,
        publicId: '',
        bytes: 0,
        format: '',
      };
    }
    throw new Error('Failed to upload image to Cloudinary');
  }
}

/**
 * Upload general media (chat images, audio, video, docs) with auto-compression and formatting.
 */
export async function uploadMediaAsset(
  fileStr: string,
  folder: string = 'chatconnect/media',
  resourceType: 'image' | 'video' | 'raw' | 'auto' = 'auto'
): Promise<UploadMediaResult> {
  try {
    const instance = getCloudinary();
    const uploadOptions: any = {
      folder,
      resource_type: resourceType,
    };

    if (resourceType === 'image' || resourceType === 'auto') {
      uploadOptions.transformation = [
        { width: 1600, height: 1600, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ];
    }

    const uploadResponse = await instance.uploader.upload(fileStr, uploadOptions);

    return {
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id,
      bytes: uploadResponse.bytes || 0,
      format: uploadResponse.format || '',
    };
  } catch (error: any) {
    console.error('[Cloudinary] uploadMediaAsset error:', error?.message || error);
    throw new Error('Failed to upload media asset to Cloudinary');
  }
}

/**
 * Delete an asset from Cloudinary by publicId.
 */
export async function deleteMediaAsset(
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<boolean> {
  if (!publicId) return false;
  try {
    const instance = getCloudinary();
    const result = await instance.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`[Cloudinary] Deleted asset public_id: ${publicId} (${resourceType}), result:`, result.result);
    return result.result === 'ok' || result.result === 'not_found';
  } catch (error: any) {
    console.error(`[Cloudinary] Failed to delete asset public_id ${publicId}:`, error?.message || error);
    return false;
  }
}

/**
 * Delete an avatar image from Cloudinary using its public_id.
 */
export async function deleteAvatar(publicId: string): Promise<boolean> {
  return deleteMediaAsset(publicId, 'image');
}

/**
 * Generate a signature for client-side uploads.
 */
export function generateUploadSignature(folder: string) {
  const instance = getCloudinary();
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = instance.utils.api_sign_request(
    {
      folder,
      timestamp,
    },
    process.env.CLOUDINARY_API_SECRET || ''
  );
  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    folder,
  };
}

/**
 * Fetch Cloudinary account storage and usage statistics.
 */
export async function getCloudinaryAccountUsage(): Promise<any> {
  try {
    const instance = getCloudinary();
    const usage = await instance.api.usage();
    return usage;
  } catch (error: any) {
    console.error('[Cloudinary] Failed to fetch usage metrics:', error?.message || error);
    return null;
  }
}

/**
 * Lists resources under a folder prefix in Cloudinary.
 */
export async function listCloudinaryFolderResources(
  prefix: string = 'chatconnect/',
  maxResults: number = 500
): Promise<Array<{ public_id: string; bytes: number; format: string; created_at: string; resource_type: string }>> {
  try {
    const instance = getCloudinary();
    const resourceTypes: Array<'image' | 'video' | 'raw'> = ['image', 'video', 'raw'];
    const allResources: Array<{ public_id: string; bytes: number; format: string; created_at: string; resource_type: string }> = [];

    for (const rType of resourceTypes) {
      try {
        const res = await instance.api.resources({
          type: 'upload',
          prefix,
          max_results: maxResults,
          resource_type: rType,
        });
        if (res && res.resources) {
          for (const item of res.resources) {
            allResources.push({
              public_id: item.public_id,
              bytes: item.bytes || 0,
              format: item.format || '',
              created_at: item.created_at || '',
              resource_type: rType,
            });
          }
        }
      } catch (err: any) {
        // Folder/resource_type combination might be empty, continue gracefully
      }
    }

    return allResources;
  } catch (error: any) {
    console.error('[Cloudinary] Failed to list folder resources:', error?.message || error);
    return [];
  }
}
