import { Router } from 'express';
import { 
  getChats, 
  createChat, 
  getMessages, 
  sendMessageHttp, 
  forwardMessages,
  createGroup,
  updateGroupSettings,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  promoteGroupAdmin,
  searchMessages
} from '../controllers/chat.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateJWT);

router.get('/', getChats);
router.post('/', createChat);
router.post('/forward', forwardMessages);

// Group management routes
router.post('/group', createGroup);
router.put('/group/:chatId/settings', updateGroupSettings);
router.post('/group/:chatId/members', addGroupMembers);
router.delete('/group/:chatId/members/:memberId', removeGroupMember);
router.post('/group/:chatId/leave', leaveGroup);
router.put('/group/:chatId/admins', promoteGroupAdmin);

// Message search routes
router.get('/search', searchMessages); // search all chats
router.get('/:chatId/search', searchMessages); // search single chat

router.get('/:chatId/messages', getMessages);
router.post('/:chatId/messages', sendMessageHttp);

export default router;

