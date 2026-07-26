import { Router } from 'express';
import { getCloudinarySignature, getLinkPreview } from '../controllers/media.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateJWT);

router.get('/cloudinary-signature', getCloudinarySignature);
router.post('/link-preview', getLinkPreview);

export default router;
