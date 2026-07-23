import { Router } from 'express';
import { getChats, createChat, getMessages, sendMessageHttp, forwardMessages } from '../controllers/chat.controller.js';
import { authenticateJWT } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticateJWT);

router.get('/', getChats);
router.post('/', createChat);
router.post('/forward', forwardMessages);
router.get('/:chatId/messages', getMessages);
router.post('/:chatId/messages', sendMessageHttp);

export default router;
