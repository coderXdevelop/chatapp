import { Router } from 'express';
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUserOrChat,
  toggleNotifications,
  toggleChatMute,
  getStatusPrivacy,
  updateStatusPrivacy,
} from '../controllers/user.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateJWT);

router.post('/block/:targetUserId', blockUser);
router.post('/unblock/:targetUserId', unblockUser);
router.get('/blocked', getBlockedUsers);
router.post('/report', reportUserOrChat);

router.put('/profile/notifications', toggleNotifications);
router.post('/chats/:chatId/mute', toggleChatMute);

router.get('/status-privacy', getStatusPrivacy);
router.put('/status-privacy', updateStatusPrivacy);

export default router;
