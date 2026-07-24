import { Router } from 'express';
import { getCloudinarySignature } from '../controllers/media.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateJWT);

router.get('/cloudinary-signature', getCloudinarySignature);

export default router;
