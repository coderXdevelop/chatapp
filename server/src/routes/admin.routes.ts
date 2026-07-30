import { Router } from 'express';
import { getCloudinaryStatus, triggerCloudinaryCleanup } from '../controllers/admin.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { requireAdminSecret } from '../middleware/admin.middleware.js';

const router = Router();

// Secure all admin routes with JWT and Admin secret key check
router.use(authenticateJWT, requireAdminSecret);

// GET /api/admin/cloudinary-status
router.get('/cloudinary-status', getCloudinaryStatus);

// POST /api/admin/cloudinary-cleanup
router.post('/cloudinary-cleanup', triggerCloudinaryCleanup);

export default router;
