import { Queue, Worker } from 'bullmq';
import redisClient from '../config/redis.js';
import prisma from '../config/db.js';
import { messaging } from '../config/firebase.js';

const QUEUE_NAME = 'notification-queue';
const ACTIVE_CHAT_KEY_PREFIX = "activeChat:"; // Must match socketHandler

// The Queue
export const notificationQueue = new Queue(QUEUE_NAME, {
  connection: redisClient,
});

// The Worker
new Worker(QUEUE_NAME, async (job) => {
  const { chatId, senderId, messageContent } = job.data;

  try {
    console.log(`📬 Worker processing job: Sending notification for chat ${chatId}`);

    // 1. Find all users in the chat EXCEPT the sender
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        users: {
          where: { id: { not: senderId } },
          select: { id: true, fcmTokens: true },
        },
      },
    });

    if (!chat || !chat.users || chat.users.length === 0) {
      console.log(`No recipients found for chat ${chatId} notification.`);
      return;
    }

    // Check Redis to see which recipients are active in this specific chat
    const recipientIds = chat.users.map(u => u.id);
    const activeChatStatuses = await Promise.all(
        recipientIds.map(id => redisClient.get(`${ACTIVE_CHAT_KEY_PREFIX}${id}`))
    );

    const inactiveRecipients = chat.users.filter((user, index) =>
        activeChatStatuses[index] !== chatId // Send notification if user is not active in THIS chat
    );

    if (inactiveRecipients.length === 0) {
       console.log(`All recipients are active in chat ${chatId}. No FCM needed.`);
       return;
    }

    const tokens = inactiveRecipients.flatMap(user => user.fcmTokens).filter(token => token);
    if (tokens.length === 0) {
      console.log(`No valid FCM tokens found for inactive recipients in chat ${chatId}.`);
      return;
    }

    // 4. Send FCM Notification
    // You might want sender's name for the notification title/body
    const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true } });
    const senderName = sender?.name || 'Someone';

    const messagePayload = {
      notification: {
        title: `New message from ${senderName}`,
        body: messageContent.length > 100 ? `${messageContent.substring(0, 97)}...` : messageContent,
      },
      tokens: tokens,
      // You can add 'data' payload here too if you want to navigate the user
      data: { chatId: chatId, type: 'new_message' }
    };

    const response = await messaging.sendEachForMulticast(messagePayload);
    console.log(`FCM response for chat ${chatId}: Success: ${response.successCount}, Failure: ${response.failureCount}`);

  } catch (error) {
    console.error(`Error processing notification job for chat ${chatId}:`, error);
  }
}, { connection: redisClient });

console.log('Notification worker is running...');