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

const router = Router();

router.post('/login', login);
router.post('/register-init', registerInit);
router.post('/verify-register-otp', verifyRegisterOTP);
router.post('/complete-registration', completeRegistration);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Legacy/OTP-only routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTPHandler);

router.post('/refresh', refreshSession);
router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, updateProfile);
router.patch('/push-token', authenticateJWT, updatePushToken);
router.delete('/avatar', authenticateJWT, removeAvatar);
router.delete('/account', authenticateJWT, deleteAccount);

export default router;
