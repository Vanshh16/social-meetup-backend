import { Parser } from "json2csv";
import prisma from "../config/db.js";
import { messaging } from "../config/firebase.js";
import AppError from "../utils/appError.js";

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
      createdAt: "desc",
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
        create: subcategories.map((subName) => ({ name: subName })),
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

const REFERRAL_REWARD_KEY = "REFERRAL_REWARD_AMOUNT";

export const fetchReferralReward = async () => {
  const setting = await prisma.appSettings.findUnique({
    where: { key: REFERRAL_REWARD_KEY },
  });
  // Return the stored value, or a default of 0 if not set
  return setting ? parseFloat(setting.value) : 0;
};

export const updateReferralReward = async (amount) => {
  if (typeof amount !== "number" || amount < 0) {
    throw new AppError("Invalid credit amount.", 400);
  }
  return prisma.appSettings.upsert({
    where: { key: REFERRAL_REWARD_KEY },
    update: { value: amount.toString() },
    create: { key: REFERRAL_REWARD_KEY, value: amount.toString() },
  });
};

export const manuallyCreditWallet = async ({ userId, amount, description }) => {
  if (typeof amount !== "number" || amount <= 0) {
    throw new AppError("Invalid credit amount.", 400);
  }

  // Use a transaction to ensure both operations (update wallet, create transaction record) succeed or fail together.
  return prisma.$transaction(async (tx) => {
    // 1. Find the user's wallet
    const wallet = await tx.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new AppError("User wallet not found.", 404);
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
        type: "CREDIT",
        description: description || "Manual credit by admin",
      },
    });

    return transaction;
  });
};

// --- NEW: Function to issue a reward ---
export const issueRewardToWallet = async ({ userId, amount, description }) => {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });
    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: 'REWARD',
        description: description || 'Reward issued by admin',
      },
    });
  });
};

// --- Function for an admin to debit a wallet ---
export const manuallyDebitWallet = async ({ userId, amount, description }) => {
  // Uses the same logic as the user-facing debit function
  return debitUserWallet(userId, amount, description || 'Manual debit by admin');
};

export const fetchAllReports = async () => {
  return prisma.userReport.findMany({
    orderBy: {
      createdAt: "desc",
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
      reporter: {
        select: { id: true, name: true, email: true, mobileNumber: true },
      },
      reported: {
        select: {
          id: true,
          name: true,
          email: true,
          mobileNumber: true,
          isVerified: true,
        },
      },
    },
  });
  if (!report) {
    throw new AppError("Report not found.", 404);
  }
  return report;
};

export const modifyReportStatus = async (reportId, status) => {
  // Add validation to ensure status is one of the allowed enum values
  if (!["PENDING", "RESOLVED", "ACTION_TAKEN"].includes(status)) {
    throw new AppError("Invalid status provided.", 400);
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
    prisma.payment.count({ where: { status: "SUCCESS" } }),
    // 4. New meetups in the last week
    prisma.meetup.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    // 5. Top 5 most popular categories
    prisma.meetup.groupBy({
      by: ["category"],
      _count: {
        category: true,
      },
      orderBy: {
        _count: {
          category: "desc",
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
    trendingCategories: trendingCategories.map((item) => ({
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
    acc[setting.key] = !isNaN(setting.value)
      ? parseFloat(setting.value)
      : setting.value;
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
  const updateOperations = Object.keys(settings).map((key) => {
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
    throw new AppError(
      "User does not have any registered devices for notifications.",
      404
    );
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
    console.error("Error sending message:", error);
    throw new Error("Failed to send notification.");
  }
};

/**
 * Sends a push notification to MULTIPLE users.
 * @param {string[]} userIds - An array of user IDs to notify.
 * @param {string} title - The title of the notification.
 * @param {string} body - The message content of the notification.
 */
export const sendNotificationToMultipleUsers = async (userIds, title, body) => {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new AppError("An array of userIds is required.", 400);
  }
  // 1. Fetch all FCM tokens for the given user IDs
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      fcmTokens: { isEmpty: false }, // Only get users with tokens
    },
    select: { fcmTokens: true },
  });

  // 2. Combine all tokens into a single flat array
  const allTokens = users.flatMap((user) => user.fcmTokens);

  if (allTokens.length === 0) {
    throw new AppError(
      "None of the selected users have registered devices.",
      404
    );
  }

  // 3. Send the notification to all tokens
  const message = {
    notification: { title, body },
    tokens: allTokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    // console.log(response);
    
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(allTokens[idx]);
        }
      });
      // console.log('List of tokens that caused failures: ' + failedTokens);
    }
    // console.log("Successfully sent bulk message:", response);
    return { success: true, ...response };
  } catch (error) {
    console.error("Error sending bulk message:", error);
    throw new Error("Failed to send bulk notification.");
  }
};

/**
 * Sends a push notification to ALL users who have a registered device.
 * @param {string} title - The title of the notification.
 * @param {string} body - The message content of the notification.
 */
export const sendNotificationToAllUsers = async (title, body) => {
  // 1. Fetch all users who have at least one FCM token
  const usersWithTokens = await prisma.user.findMany({
    where: {
      fcmTokens: {
        isEmpty: false,
      },
    },
    select: {
      fcmTokens: true,
    },
  });

  // 2. Combine all tokens into a single flat array
  const allTokens = usersWithTokens.flatMap((user) => user.fcmTokens);

  if (allTokens.length === 0) {
    throw new AppError(
      "No users have registered devices for notifications.",
      404
    );
  }

  // 3. Send the notification to all tokens
  const message = {
    notification: { title, body },
    tokens: allTokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);
    // console.log("Successfully sent global announcement:", response);
    return { success: true, ...response };
  } catch (error) {
    console.error("Error sending global announcement:", error);
    throw new Error("Failed to send global notification.");
  }
};




// ----------------------------- LATEST -----------------------------

/**
 * Searches and filters users based on admin criteria.
 * @param {object} query - The search query (e.g., { search: 'Rahul', status: 'ACTIVE' }).
 */
export const searchUsers = async (query) => {
    const whereClause = {};

    if (query.search) {
        whereClause.OR = [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { mobileNumber: { contains: query.search, mode: 'insensitive' } },
        ];
    }

    if (query.status) {
        if (query.status === 'ACTIVE') whereClause.isSuspended = false;
        if (query.status === 'SUSPENDED') whereClause.isSuspended = true;
        // Add more status filters as needed (e.g., PENDING for !isVerified)
    }

    return prisma.user.findMany({
        where: whereClause,
        select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
            isVerified: true,
            isSuspended: true, // Assuming you add this to your schema
            createdAt: true,
        },
    });
};

/**
 * Creates a new user from the admin panel.
 * @param {object} userData - The data for the new user.
 */
export const createUserByAdmin = async (userData) => {
    // You might want to add password generation logic here
    return prisma.user.create({
        data: {
            ...userData,
            authMethod: 'MOBILE_OTP' // Or a default method
        },
    });
};

/**
 * Exports the current user list to a CSV format.
 */
export const exportUsersToCsv = async () => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
            isVerified: true,
            isSuspended: true,
            createdAt: true,
        },
    });

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(users);
    return csv;
};

/**
 * Fetches all meetups with optional filtering for the admin panel.
 * @param {object} query - The filter query (e.g., { status: 'PENDING' }).
 */
export const fetchAllMeetups = async (query) => {
    const whereClause = {};

    // Example filter by status (you can add more for date, category, etc.)
    if (query.status) {
        whereClause.status = query.status.toUpperCase();
    }

    return prisma.meetup.findMany({
        where: whereClause,
        include: {
            user: { select: { name: true } }, // Creator's name
            _count: { select: { JoinRequest: true } } // Count of participants
        },
        orderBy: { createdAt: 'desc' }
    });
};

/**
 * Creates a new meetup from the admin panel.
 * @param {object} meetupData - The data for the new meetup.
 */
export const scheduleMeetupByAdmin = async (meetupData) => {
    // You'll need to decide which user to assign as the creator,
    // or you could have a generic "system" user for admin-created meetups.
    if (!meetupData.createdBy) {
        throw new AppError("A 'createdBy' userId is required to schedule a meetup.", 400);
    }
    return prisma.meetup.create({
        data: meetupData,
    });
};

/**
 * Fetches reward statistics for the admin dashboard.
 */
export const getRewardStats = async () => {
    // These would be more complex aggregate queries in a real scenario
    const totalRewardsPaid = await prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: { type: 'REWARD' },
    });

    const referralRewards = await prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: { type: 'REWARD', description: { contains: 'referral' } },
    });

    // You would add a similar query for meetup completion rewards once implemented.
    const meetupRewards = 0; // Placeholder

    return {
        totalRewardsPaid: totalRewardsPaid._sum.amount || 0,
        referralRewards: referralRewards._sum.amount || 0,
        meetupRewards: meetupRewards,
    };
};

/**
 * Fetches the history of reward price changes.
 * This would require a dedicated audit log model to be fully implemented.
 * For now, we return a placeholder.
 */
export const getRewardHistory = async () => {
    // Placeholder - A real implementation would query an audit log table.
    return [
        { date: '2025-09-15', rewardType: 'Referral Reward', previousAmount: 10, newAmount: 5, changedBy: 'Admin', reason: 'Cost optimization' }
    ];
};

/**
 * Fetches key statistics for the referral dashboard.
 */
export const getReferralStats = async () => {
    const totalReferrals = await prisma.user.count({
        where: { referredById: { not: null } },
    });

    const successfulReferrals = await prisma.user.count({
        where: {
            referredById: { not: null },
            isVerified: true,
        },
    });

    const totalRewardsPaid = await prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: {
            type: 'REWARD',
            description: { contains: 'referral' },
        },
    });

    // This is a more complex query to find the top referrer
    const topReferrers = await prisma.user.groupBy({
        by: ['referredById'],
        _count: {
            referredById: true,
        },
        where: { referredById: { not: null } },
        orderBy: {
            _count: {
                referredById: 'desc',
            },
        },
        take: 1,
    });

    let topReferrerData = null;
    if (topReferrers.length > 0) {
        const topReferrerUser = await prisma.user.findUnique({
            where: { id: topReferrers[0].referredById },
            select: { name: true },
        });
        topReferrerData = {
            name: topReferrerUser.name,
            count: topReferrers[0]._count.referredById,
        };
    }

    return {
        totalReferrals,
        successfulReferrals,
        totalRewardsPaid: totalRewardsPaid._sum.amount || 0,
        topReferrer: topReferrerData,
    };
};

/**
 * Fetches the detailed history of all referrals.
 */
export const getReferralHistory = async (query) => {
    const whereClause = {
        referredById: { not: null }
    };

    // Example filter by status
    if (query.status === 'COMPLETED') whereClause.isVerified = true;
    if (query.status === 'PENDING') whereClause.isVerified = false;

    const referredUsers = await prisma.user.findMany({
        where: whereClause,
        select: {
            id: true,
            name: true,
            createdAt: true,
            isVerified: true,
            referredById: true,
        },
        orderBy: { createdAt: 'desc' }
    });

    // Now, fetch the referrer details for each
    const referrerIds = [...new Set(referredUsers.map(u => u.referredById))];
    const referrers = await prisma.user.findMany({
        where: { id: { in: referrerIds } },
        select: { id: true, name: true }
    });
    
    const referrersMap = new Map(referrers.map(r => [r.id, r]));

    return referredUsers.map(user => ({
        referredUser: { id: user.id, name: user.name },
        referrer: referrersMap.get(user.referredById),
        date: user.createdAt,
        status: user.isVerified ? 'COMPLETED' : 'PENDING VERIFICATION',
        // You would look up the reward amount from the transaction table in a full implementation
        rewardAmount: user.isVerified ? 5 : 0, // Placeholder
    }));
};