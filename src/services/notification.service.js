import prisma from '../config/db.js';
import { io } from '../socket/socketHandler.js'; // For real-time updates
import { messaging } from '../config/firebase.js'; // For FCM push notifications
import AppError from '../utils/appError.js';

/**
 * --- The Core Function ---
 * Creates a notification, saves it to the DB, sends a real-time socket event,
 * and queues a push notification.
 * @param {object} data - The notification payload
 */
export const createNotification = async (data) => {
  const { userId, type, title, subtitle, ...rest } = data;

  if (!userId || !type || !title || !subtitle) {
    throw new AppError('Missing required notification fields', 400);
  }

  // 1. Save the notification to the database
  const newNotification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      subtitle,
      ...rest, // This includes icon, senderName, data, etc.
    },
  });

  // 2. Get the new unread count
  const unreadCount = await getUnreadCount(userId);

  // 3. Emit a real-time socket event
  if (io) {
    io.to(userId).emit('new_notification', {
      notification: newNotification,
      unreadCount: unreadCount,
    });
  }

  // 4. Send an FCM Push Notification (fire and forget)
  sendPushNotification(userId, title, subtitle);

  return newNotification;
};

/**
 * Fetches all notifications for a user with pagination and filtering.
 */
export const getNotifications = async (userId, query) => {
  const { page = 1, limit = 10, type, isRead } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const whereClause = { userId };
  if (type) whereClause.type = type;
  if (isRead) whereClause.isRead = isRead === 'true';

  const [notifications, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where: whereClause,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where: whereClause }),
  ]);

  const unreadCount = await getUnreadCount(userId);

  return { notifications, unreadCount, totalPages: Math.ceil(total / take) };
};

/**
 * Marks a specific notification as read.
 */
export const markAsRead = async (notificationId, userId) => {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new AppError('Notification not found', 404);
  if (notification.userId !== userId) throw new AppError('Unauthorized', 403);

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};

/**
 * Marks all of a user's notifications as read.
 */
export const markAllAsRead = async (userId) => {
  await prisma.notification.updateMany({
    where: { userId: userId, isRead: false },
    data: { isRead: true },
  });
  return { success: true, message: 'All notifications marked as read.' };
};

/**
 * Deletes a specific notification.
 */
export const deleteNotification = async (notificationId, userId) => {
  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) throw new AppError('Notification not found', 404);
  if (notification.userId !== userId) throw new AppError('Unauthorized', 403);

  await prisma.notification.delete({ where: { id: notificationId } });
  return { success: true, message: 'Notification deleted.' };
};

/**
 * Deletes all of a user's notifications.
 */
export const deleteAllNotifications = async (userId) => {
  await prisma.notification.deleteMany({
    where: { userId: userId },
  });
  return { success: true, message: 'All notifications cleared.' };
};

/**
 * Gets the count of unread notifications for a user.
 */
export const getUnreadCount = async (userId) => {
  return prisma.notification.count({
    where: { userId: userId, isRead: false },
  });
};

// --- Helper for FCM ---
const sendPushNotification = async (userId, title, body) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true },
    });

    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}. Skipping push.`);
      return;
    }

    const message = {
      notification: { title, body },
      tokens: user.fcmTokens,
    };

    await messaging.sendEachForMulticast(message);
    console.log(`Push notification sent to user ${userId}`);
  } catch (error) {
    console.error(`Failed to send push notification to user ${userId}:`, error);
  }
};