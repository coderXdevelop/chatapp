import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { getCallLogs, getIceServers } from '../controllers/call.controller.js';

const router = Router();

router.use(authenticateJWT);

router.get('/ice-servers', getIceServers);
router.get('/logs', getCallLogs);

export default router;

