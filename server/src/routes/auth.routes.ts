import { Router } from 'express';
import {
  completeRegistration,
  getMe,
  login,
  refreshSession,
  registerInit,
  sendOTP,
  updateProfile,
  verifyOTPHandler,
  verifyRegisterOTP,
} from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/login', login);
router.post('/register-init', registerInit);
router.post('/verify-register-otp', verifyRegisterOTP);
router.post('/complete-registration', completeRegistration);

// Legacy/OTP-only routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTPHandler);

router.post('/refresh', refreshSession);
router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, updateProfile);

export default router;
