import { Router } from 'express';
import {
  completeRegistration,
  deleteAccount,
  forgotPassword,
  getMe,
  login,
  refreshSession,
  registerInit,
  removeAvatar,
  resetPassword,
  sendOTP,
  updateProfile,
  verifyOTPHandler,
  verifyRegisterOTP,
  updatePushToken,
} from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';
import { authRateLimiter, otpRateLimiter } from '../middleware/rateLimiter.middleware.js';

const router = Router();

// Rate-limited authentication & OTP routes
router.post('/login', authRateLimiter, login);
router.post('/register-init', otpRateLimiter, registerInit);
router.post('/verify-register-otp', authRateLimiter, verifyRegisterOTP);
router.post('/complete-registration', authRateLimiter, completeRegistration);
router.post('/forgot-password', otpRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);

// Legacy/OTP-only routes with rate limiting
router.post('/send-otp', otpRateLimiter, sendOTP);
router.post('/verify-otp', authRateLimiter, verifyOTPHandler);

router.post('/refresh', authRateLimiter, refreshSession);
router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, updateProfile);
router.patch('/push-token', authenticateJWT, updatePushToken);
router.delete('/avatar', authenticateJWT, removeAvatar);
router.delete('/account', authenticateJWT, deleteAccount);

export default router;
