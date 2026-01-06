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

  const notifications = await prisma.notification.findMany({
    where: whereClause,
    skip,
    take,
    orderBy: { createdAt: 'desc' },
  });

  const total = await prisma.notification.count({
    where: whereClause,
  });

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

/**
 * WORKER: Finds due campaigns and sends them.
 * This should be called by a Cron Job every minute.
 */
export const processDueNotifications = async () => {
  const now = new Date();

  // 1. Find campaigns that are PENDING and due (scheduledAt <= now)
  const campaigns = await prisma.adminNotification.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now }
    }
  });

  for (const campaign of campaigns) {
    console.log(`🚀 Processing Campaign: ${campaign.title}`);

    // Mark as PROCESSING to prevent double-sending
    await prisma.adminNotification.update({
      where: { id: campaign.id },
      data: { status: 'PROCESSING' }
    });

    try {
      // 2. Find Target Users
      const whereUser = {
        isVerified: true,
        isSuspended: false,
        fcmTokens: { isEmpty: false } // Only get users we can actually push to
      };

      // Apply filters if they are not null (null means 'All')
      if (campaign.targetCityId) whereUser.cityId = campaign.targetCityId; // Make sure User model has cityId relation/field
      // OR if using string match: whereUser.city = { contains: campaign.targetCityId }

      if (campaign.targetGender) whereUser.gender = campaign.targetGender;

      const users = await prisma.user.findMany({
        where: whereUser,
        select: { id: true, fcmTokens: true }
      });

      if (users.length === 0) {
        await prisma.adminNotification.update({
          where: { id: campaign.id },
          data: { status: 'COMPLETED', sentCount: 0 }
        });
        continue;
      }

      // 3. Create In-App Notifications (Bulk Insert)
      // This ensures users see it in their notification history inside the app
      const notificationsData = users.map(u => ({
        userId: u.id,
        type: 'admin_alert', // You might need to add this to your Type Enum or use 'other'
        title: campaign.title,
        subtitle: campaign.message,
        // image: campaign.image, // Add if your Notification model supports it
        isRead: false
      }));

      await prisma.notification.createMany({
        data: notificationsData
      });

      // 4. Send FCM Push Notifications (Batching)
      const allTokens = users.flatMap(u => u.fcmTokens || []);

      // Firebase allows up to 500 tokens per multicast. We must batch if > 500.
      const BATCH_SIZE = 500;
      for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
        const batchTokens = allTokens.slice(i, i + BATCH_SIZE);

        if (batchTokens.length > 0) {
          const message = {
            notification: {
              title: campaign.title,
              body: campaign.message
            },
            tokens: batchTokens,
          };
          try {
            await messaging.sendEachForMulticast(message);
          } catch (err) {
            console.error("Batch send failed", err);
          }
        }
      }

      // 5. Mark as COMPLETED
      await prisma.adminNotification.update({
        where: { id: campaign.id },
        data: {
          status: 'COMPLETED',
          sentCount: users.length
        }
      });

      console.log(`Campaign Sent to ${users.length} users.`);

    } catch (error) {
      console.error(`Campaign Failed: ${error.message}`);
      await prisma.adminNotification.update({
        where: { id: campaign.id },
        data: { status: 'FAILED' }
      });
    }
  }
};