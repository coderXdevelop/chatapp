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

export interface UploadAvatarResult {
  url: string;
  publicId: string;
}

/**
 * Upload an avatar image (base64 data URI or image URL) to Cloudinary.
 */
export async function uploadAvatar(fileStr: string): Promise<UploadAvatarResult> {
  try {
    const instance = getCloudinary();
    const uploadResponse = await instance.uploader.upload(fileStr, {
      folder: 'chatconnect/avatars',
    });

    return {
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id,
    };
  } catch (error: any) {
    console.error('[Cloudinary] uploadAvatar error:', error?.message || error);
    if (fileStr && (fileStr.startsWith('data:') || fileStr.startsWith('http'))) {
      console.warn('[Cloudinary] Falling back to direct image data URI due to Cloudinary API restriction.');
      return {
        url: fileStr,
        publicId: '',
      };
    }
    throw new Error('Failed to upload image to Cloudinary');
  }
}

/**
 * Delete an avatar image from Cloudinary using its public_id.
 */
export async function deleteAvatar(publicId: string): Promise<boolean> {
  if (!publicId) return false;
  try {
    const instance = getCloudinary();
    const result = await instance.uploader.destroy(publicId);
    console.log(`[Cloudinary] Deleted avatar public_id: ${publicId}, result:`, result.result);
    return result.result === 'ok';
  } catch (error: any) {
    console.error(`[Cloudinary] Failed to delete avatar public_id ${publicId}:`, error?.message || error);
    return false;
  }
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
