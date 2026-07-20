import { Router } from 'express';
import { firebaseLogin, getMe, refreshSession, updateProfile } from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/firebase-login', firebaseLogin);
router.post('/refresh', refreshSession);
router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, updateProfile);

export default router;
