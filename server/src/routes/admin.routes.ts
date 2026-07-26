import { Router } from 'express';
import { getCloudinaryStatus, triggerCloudinaryCleanup } from '../controllers/admin.controller.js';

const router = Router();

// GET /api/admin/cloudinary-status
router.get('/cloudinary-status', getCloudinaryStatus);

// POST /api/admin/cloudinary-cleanup
router.post('/cloudinary-cleanup', triggerCloudinaryCleanup);

export default router;
