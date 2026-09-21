import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { getCallLogs, deleteCallLog } from '../controllers/call.controller.js';

const router = Router();

router.use(authenticateJWT);

router.get('/logs', getCallLogs);
router.delete('/logs/:id', deleteCallLog);

export default router;
