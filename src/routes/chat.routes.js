import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { getUserChatsController, getChatMessagesController } from '../controllers/chat.controller.js';

const router = Router();
router.use(requireAuth);

// Get a list of all chats for the logged-in user
router.get('/', getUserChatsController);

// Get the message history for a specific chat
router.get('/:chatId/messages', getChatMessagesController);

export default router;