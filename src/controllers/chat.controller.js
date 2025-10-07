import { getUserChats, getChatMessages } from '../services/chat.service.js';

export const getUserChatsController = async (req, res, next) => {
    try {
        const chats = await getUserChats(req.user.id);
        res.status(200).json({ success: true, data: chats });
    } catch (error) {
        next(error);
    }
};

export const getChatMessagesController = async (req, res, next) => {
    try {
        const { chatId } = req.params;
        const messages = await getChatMessages(chatId, req.user.id);
        res.status(200).json({ success: true, data: messages });
    } catch (error) {
        next(error);
    }
};