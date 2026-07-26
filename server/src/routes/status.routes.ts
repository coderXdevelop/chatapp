import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { createStatus, getStatusFeed, deleteStatus } from '../controllers/status.controller.js';

const router = Router();

router.use(authenticateJWT);

router.post('/', createStatus);
router.get('/feed', getStatusFeed);
router.delete('/:id', deleteStatus);

export default router;
