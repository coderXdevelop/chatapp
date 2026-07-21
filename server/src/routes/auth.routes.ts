import { Router } from 'express';
import { getMe, refreshSession, sendOTP, updateProfile, verifyOTPHandler } from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTPHandler);
router.post('/refresh', refreshSession);
router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, updateProfile);

export default router;
