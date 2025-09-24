import prisma from '../config/db.js';
import { messaging } from '../config/firebase.js';
import AppError from '../utils/appError.js';

/**
 * Fetches all users from the database, excluding their passwords.
 */
export const fetchAllUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      mobileNumber: true,
      role: true,
      isVerified: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

/**
 * Updates a user's status fields like role or verification.
 * @param {string} userId - The ID of the user to update.
 * @param {object} data - The data to update, e.g., { role: 'USER', isVerified: false }.
 */
export const modifyUserStatus = async (userId, data) => {
  // We can add more specific validation here if needed
  const { role, isVerified } = data;

  return prisma.user.update({
    where: { id: userId },
    data: {
      role,
      isVerified,
    },
    select: {
      id: true,
      name: true,
      role: true,
      isVerified: true,
    },
  });
};

// --- Category Service Functions ---

export const fetchAllCategories = async () => {
  return prisma.category.findMany({
    include: {
      subcategories: {
        select: { id: true, name: true },
      },
    },
  });
};

export const addNewCategory = async (name, subcategories = []) => {
  return prisma.category.create({
    data: {
      name,
      subcategories: {
        create: subcategories.map(subName => ({ name: subName })),
      },
    },
  });
};

export const modifyCategory = async (categoryId, newName) => {
  return prisma.category.update({
    where: { id: categoryId },
    data: { name: newName },
  });
};

export const removeCategory = async (categoryId) => {
  // Prisma requires deleting related subcategories first
  return prisma.$transaction(async (tx) => {
    await tx.subCategory.deleteMany({
      where: { categoryId: categoryId },
    });
    await tx.category.delete({
      where: { id: categoryId },
    });
  });
};

const REFERRAL_REWARD_KEY = 'REFERRAL_REWARD_AMOUNT';

export const fetchReferralReward = async () => {
  const setting = await prisma.appSettings.findUnique({
    where: { key: REFERRAL_REWARD_KEY },
  });
  // Return the stored value, or a default of 0 if not set
  return setting ? parseFloat(setting.value) : 0;
};

export const updateReferralReward = async (amount) => {
  if (typeof amount !== 'number' || amount < 0) {
    throw new AppError('Invalid credit amount.', 400);
  }
  return prisma.appSettings.upsert({
    where: { key: REFERRAL_REWARD_KEY },
    update: { value: amount.toString() },
    create: { key: REFERRAL_REWARD_KEY, value: amount.toString() },
  });
};

export const manuallyCreditWallet = async ({ userId, amount, description }) => {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new AppError('Invalid credit amount.', 400);
  }

  // Use a transaction to ensure both operations (update wallet, create transaction record) succeed or fail together.
  return prisma.$transaction(async (tx) => {
    // 1. Find the user's wallet
    const wallet = await tx.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new AppError('User wallet not found.', 404);
    }

    // 2. Update the wallet balance
    await tx.userWallet.update({
      where: { id: wallet.id },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    // 3. Create a transaction record for auditing
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: amount,
        type: 'CREDIT',
        description: description || 'Manual credit by admin',
      },
    });

    return transaction;
  });
};

export const fetchAllReports = async () => {
  return prisma.userReport.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      reporter: { select: { id: true, name: true } },
      reported: { select: { id: true, name: true } },
    },
  });
};

export const fetchReportDetails = async (reportId) => {
  const report = await prisma.userReport.findUnique({
    where: { id: reportId },
    include: {
      reporter: { select: { id: true, name: true, email: true, mobileNumber: true } },
      reported: { select: { id: true, name: true, email: true, mobileNumber: true, isVerified: true } },
    },
  });
  if (!report) {
  throw new AppError('Report not found.', 404);
  }
  return report;
};

export const modifyReportStatus = async (reportId, status) => {
  // Add validation to ensure status is one of the allowed enum values
  if (!['PENDING', 'RESOLVED', 'ACTION_TAKEN'].includes(status)) {
    throw new AppError('Invalid status provided.', 400);
  }

  return prisma.userReport.update({
    where: { id: reportId },
    data: { status },
  });
};

export const fetchDashboardStats = async () => {
  // Get the date for 7 days ago to calculate recent activity
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Run multiple aggregate queries in parallel
  const [
    totalUsers,
    totalMeetups,
    totalSuccessfulTransactions,
    meetupsInLast7Days,
    trendingCategories,
  ] = await Promise.all([
    // 1. Total number of users
    prisma.user.count(),
    // 2. Total number of meetups
    prisma.meetup.count(),
    // 3. Total successful payments
    prisma.payment.count({ where: { status: 'SUCCESS' } }),
    // 4. New meetups in the last week
    prisma.meetup.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    // 5. Top 5 most popular categories
    prisma.meetup.groupBy({
      by: ['category'],
      _count: {
        category: true,
      },
      orderBy: {
        _count: {
          category: 'desc',
        },
      },
      take: 5,
    }),
  ]);

  // Format the results into a clean object
  return {
    totalUsers,
    totalMeetups,
    totalSuccessfulTransactions,
    meetupsInLast7Days,
    trendingCategories: trendingCategories.map(item => ({
      category: item.category,
      count: item._count.category,
    })),
  };
};

/**
 * Fetches all settings from the database and returns them as a key-value object.
 */
export const fetchAllSettings = async () => {
  const settingsList = await prisma.appSettings.findMany();

  // Convert the array of {key, value} objects into a single object
  const settingsObject = settingsList.reduce((acc, setting) => {
    // Attempt to parse numbers, otherwise keep as string
    acc[setting.key] = !isNaN(setting.value) ? parseFloat(setting.value) : setting.value;
    return acc;
  }, {});

  // Set default values if they are not in the database
  if (!settingsObject.REFERRAL_REWARD_AMOUNT) {
    settingsObject.REFERRAL_REWARD_AMOUNT = 0;
  }
  if (!settingsObject.MEETUP_SEARCH_RADIUS_KM) {
    settingsObject.MEETUP_SEARCH_RADIUS_KM = 25;
  }

  return settingsObject;
};

/**
 * Updates multiple application settings in a single transaction.
 * @param {object} settings - An object where keys are setting names and values are the new setting values.
 */
export const updateSettings = async (settings) => {
  // Create an array of upsert operations
  const updateOperations = Object.keys(settings).map(key => {
    const value = settings[key];
    return prisma.appSettings.upsert({
      where: { key },
      update: { value: value.toString() },
      create: { key, value: value.toString() },
    });
  });

  // Run all updates within a single transaction
  return prisma.$transaction(updateOperations);
};

/**
 * Sends a push notification to a SINGLE user's devices.
 * @param {string} userId - The ID of the user to notify.
 * @param {string} title - The title of the notification.
 * @param {string} body - The message content of the notification.
 */
export const sendNotificationToUser = async (userId, title, body) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmTokens: true },
  });

  if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
    throw new AppError('User does not have any registered devices for notifications.', 404);
  }

  const message = {
    notification: { title, body },
    tokens: user.fcmTokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    // if (response.data.failureCount > 0) {
    //     const failedTokens = [];
    //     response.responses.forEach((resp, idx) => {
    //         if (!resp.success) {
    //             failedTokens.push(user.fcmTokens[idx]);
    //         }
    //     });
    //     console.log('List of tokens that caused failures: ' + failedTokens);
    // }
    // console.log('Successfully sent message:', response);
    return { success: true, ...response };
  } catch (error) {
    console.error('Error sending message:', error);
    throw new Error('Failed to send notification.');
  }
};

/**
 * Sends a push notification to MULTIPLE users.
 * @param {string[]} userIds - An array of user IDs to notify.
 * @param {string} title - The title of the notification.
 * @param {string} body - The message content of the notification.
 */
export const sendNotificationToMultipleUsers = async (userIds, title, body) => {
  // 1. Fetch all FCM tokens for the given user IDs
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      fcmTokens: { isEmpty: false }, // Only get users with tokens
    },
    select: { fcmTokens: true },
  });

  // 2. Combine all tokens into a single flat array
  const allTokens = users.flatMap(user => user.fcmTokens);

  if (allTokens.length === 0) {
    throw new AppError('None of the selected users have registered devices.', 404);
  }

  // 3. Send the notification to all tokens
  const message = {
    notification: { title, body },
    tokens: allTokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    if (response.data.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                failedTokens.push(user.fcmTokens[idx]);
            }
        });
        // console.log('List of tokens that caused failures: ' + failedTokens);
    }
    console.log('Successfully sent bulk message:', response);
    return { success: true, ...response };
  } catch (error) {
    console.error('Error sending bulk message:', error);
    throw new Error('Failed to send bulk notification.');
  }
};