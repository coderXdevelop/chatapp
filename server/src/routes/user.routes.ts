import { Router } from 'express';
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUserOrChat,
  toggleNotifications,
  toggleChatMute,
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

export default router;
