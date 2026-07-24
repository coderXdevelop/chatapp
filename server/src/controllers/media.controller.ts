import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { generateUploadSignature } from '../services/cloudinary.service.js';

export async function getCloudinarySignature(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const folder = 'chatconnect/messages';
    const signatureData = generateUploadSignature(folder);
    return res.json(signatureData);
  } catch (error: any) {
    console.error('[MediaController] getCloudinarySignature error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to generate upload signature' });
  }
}
