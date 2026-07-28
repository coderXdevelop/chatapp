import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import {
  createStatus,
  getStatusFeed,
  deleteStatus,
  recordStatusView,
  reactToStatus,
  getStatusViewers,
  replyToStatus,
} from '../controllers/status.controller.js';

const router = Router();

router.use(authenticateJWT);

router.post('/', createStatus);
router.get('/feed', getStatusFeed);
router.delete('/:id', deleteStatus);

router.post('/:id/view', recordStatusView);
router.post('/:id/react', reactToStatus);
router.get('/:id/viewers', getStatusViewers);
router.post('/:id/reply', replyToStatus);

export default router;
