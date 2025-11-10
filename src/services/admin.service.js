import { Parser } from "json2csv";
import prisma from "../config/db.js";
import { messaging } from "../config/firebase.js";
import AppError from "../utils/appError.js";
import { comparePasswords } from "../utils/password.js";
import { createNotification } from "./notification.service.js";
import { creditUserWallet, debitUserWallet } from "./wallet.service.js";

/**
 * Authenticates an admin using mobile number and password.
 * @param {string} mobileNumber - The admin's mobile number.
 * @param {string} password - The admin's plain text password.
 * @returns {Promise<object>} The admin user object (without password).
 */
export const loginAdminWithPassword = async (mobileNumber, password) => {
  // 1. Find the user by mobile number
  const user = await prisma.user.findUnique({
    where: { mobileNumber },
  });

  // 2. Check if user exists and is an admin
  if (!user || user.role !== "ADMIN") {
    throw new AppError("Invalid credentials or not an admin", 401);
  }

  // 3. Check if password is set
  if (!user.password) {
    throw new AppError("Admin account not set up for password login.", 400);
  }

  // 4. Compare passwords
  // const isMatch = await comparePasswords(password, user.password);
  const isMatch = password === user.password;
  if (!isMatch) {
    throw new AppError("Invalid credentials or not an admin", 401);
  }

  // 5. Return user data (excluding password)
  const { password: _, ...adminUser } = user;
  return adminUser;
};

/**
 * Fetches all users from the database, excluding their passwords.
 */
export const fetchAllUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      profilePhoto: true,
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
 * Fetches the full, detailed profile of a specific user for the admin.
 * @param {string} userId - The ID of the user to fetch.
 */
export const getUserDetailsById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    // Select all fields
    select: {
      id: true,
      name: true,
      email: true,
      mobileNumber: true,
      isVerified: true,
      role: true,
      authMethod: true,
      googleId: true,
      profilePhoto: true,
      gender: true,
      dateOfBirth: true,
      city: true,
      referralCode: true,
      referredById: true,
      pictures: true,
      fcmTokens: true,
      bio: true,
      hobbies: true,
      createdAt: true,
      updatedAt: true,
      // You can also include relations like wallet or reports
      UserWallet: {
        select: { balance: true },
      },
      reportsAgainst: {
        take: 5,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return user;
};

/**
 * Updates a user's status AND creates a log entry.
 * @param {string} adminId - The ID of the admin performing the action.
 * @param {string} userId - The ID of the user to update.
 * @param {object} data - The data to update, e.g., { isSuspended: true, reason: 'Spam' }.
 */
export const modifyUserStatus = async (adminId, userId, data) => {
  const { isSuspended, reason } = data; // Get 'isSuspended' and 'reason'

  // We only care about changes to 'isSuspended' for this logic
  if (isSuspended === undefined) {
    // If just changing 'role' or 'isVerified', just do the update
    return prisma.user.update({
      where: { id: userId },
      data: { role: data.role, isVerified: data.isVerified }
    });
  }

  // This is a suspension or un-suspension action
  const action = isSuspended ? 'SUSPEND' : 'UNSUSPEND';

  // Run as a transaction to ensure both operations succeed or fail together
  return prisma.$transaction(async (tx) => {
    // 1. Update the user's status
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { isSuspended },
      select: { id: true, name: true, role: true, isVerified: true, isSuspended: true },
    });

    // 2. Create the log entry
    await tx.suspensionLog.create({
      data: {
        userId: userId,
        adminId: adminId,
        action: action,
        reason: reason || (action === 'SUSPEND' ? 'No reason provided.' : 'User unsuspended.'),
      },
    });

    return updatedUser;
  });
};

/**
 * Fetches the suspension history log with pagination.
 */
export const getSuspensionHistory = async (query) => {
  const { page = 1, limit = 10, userId } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const whereClause = {};
  if (userId) {
    whereClause.userId = userId; // Filter by a specific user
  }

  const [logs, total] = await prisma.$transaction([
    prisma.suspensionLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, profilePhoto: true } }, // The user who was actioned
        admin: { select: { id: true, name: true } }, // The admin who did it
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.suspensionLog.count({ where: whereClause }),
  ]);

  return {
    history: logs,
    totalPages: Math.ceil(total / take),
    totalLogs: total,
  };
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
  console.log(name, subcategories);
  
  return prisma.category.create({
    data: {
      name,
      subcategories: {
        create: subcategories.map((subName) => ({ name: subName })),
      },
    },
  });
};

/**
 * Modifies a category's name, price, and subcategories.
 * This is an atomic operation: it all succeeds or all fails.
 * @param {string} categoryId - The ID of the category to update.
 * @param {object} updateData - An object containing { name, price, subcategories }.
 */
export const modifyCategory = async (categoryId, updateData) => {
  const { name, price, subcategories } = updateData;

  console.log(updateData);
  
  // 1. Prepare the simple update data for the category
  const categoryUpdateData = {};
  if (name) {
    categoryUpdateData.name = name;
  }
  if (price !== undefined) {
    categoryUpdateData.price = parseFloat(price);
  }

  // 2. Use a transaction to update relations safely
  return prisma.$transaction(async (tx) => {
    // Step A: Update the main category's name and/or price
    const updatedCategory = await tx.category.update({
      where: { id: categoryId },
      data: categoryUpdateData,
    });

    // Step B: If a new list of subcategories was provided, replace the old ones
    if (subcategories && Array.isArray(subcategories)) {
      // B.1: Delete all old subcategories associated with this category
      await tx.subCategory.deleteMany({
        where: { categoryId: categoryId },
      });

      // B.2: Create all the new subcategories
      if (subcategories.length > 0) {
        await tx.subCategory.createMany({
          data: subcategories.map(subName => ({
            name: subName,
            categoryId: categoryId,
          })),
        });
      }
    }

    return updatedCategory;
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

/**
 * Fetches statistics for the category management dashboard.
 */
export const getCategoryDashboardStats = async () => {
  // 1. Get total categories
  const categoriesTotal = prisma.category.count();

  // 2. Get active meetups (defined as meetups happening today or in the future)
  const activeMeetups = prisma.meetup.count({
    where: { date: { gte: new Date() } },
  });

  // 3. Get the top category
  const topCategoryQuery = prisma.meetup.groupBy({
    by: ['category'],
    _count: {
      category: true,
    },
    orderBy: {
      _count: {
        category: 'desc',
      },
    },
    take: 1,
  });

  // 4. Get total unique locations (based on locationName)
  const locationsTotalQuery = prisma.meetup.findMany({
    select: { locationName: true },
    distinct: ['locationName'],
  });

  // Run all queries at the same time
  const [
    totalCategories,
    totalActiveMeetups,
    topCategoryResult,
    locationsResult
  ] = await prisma.$transaction([
    categoriesTotal,
    activeMeetups,
    topCategoryQuery,
    locationsTotalQuery
  ]);

  // Format the results
  const topCategory = topCategoryResult.length > 0 ? topCategoryResult[0].category : 'N/A';
  const totalLocations = locationsResult.length;

  return {
    totalCategories,
    totalActiveMeetups,
    topCategory,
    totalLocations,
  };
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


/**
 * Fetches statistics for the main wallet dashboard.
 */
export const getWalletDashboardStats = async () => {
  // Get date for 'today'
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Get total balance of all user wallets
  const totalBalance = prisma.userWallet.aggregate({
    _sum: { balance: true },
  });

  // 2. Get transactions made today
  const transactionsToday = prisma.walletTransaction.count({
    where: { createdAt: { gte: today } },
  });

  // 3. Get refunds processed (assuming description contains 'refund')
  const refundsProcessed = prisma.walletTransaction.count({
    where: {
      type: 'CREDIT',
      description: { contains: 'refund', mode: 'insensitive' },
    },
  });

//   const pendingWithdrawals = prisma.walletTransaction.aggregate({
//   where: {
//     type: 'DEBIT',
//     description: { contains: 'pending', mode: 'insensitive' },
//   },
//   _sum: { amount: true },
// });

  // 4. Get pending withdrawals (assuming a 'DEBIT' with 'PENDING' status)
  // This requires a 'status' field on WalletTransaction, which you may want to add.
  // For now, we'll placeholder this.
  // const pendingWithdrawals = { _sum: { amount: 0 } }; // Placeholder

  // Run all queries in parallel
  const [balanceResult, todayCount, refundCount, pendingResult] = await prisma.$transaction([
    totalBalance,
    transactionsToday,
    refundsProcessed,
  ]);

  return {
    totalWalletBalance: balanceResult._sum.balance || 0,
    transactionsToday: todayCount,
    refundsProcessed: refundCount,
    pendingWithdrawals: 0,
  };
};

/**
 * Fetches all wallet transactions with filtering and pagination.
 */
export const getAllWalletTransactions = async (query) => {
  console.log(query);
  
  const { page = 1, limit = 10, searchTerm, type, userId } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const whereClause = {};

  if (userId && userId !== 'all') {
    whereClause.wallet = { userId: userId };
  }

  if (type && type !== 'all') {
    whereClause.type = type; // Assumes type matches 'CREDIT', 'DEBIT', 'REWARD'
  }

  if (searchTerm) {
    whereClause.OR = [
      { description: { contains: searchTerm, mode: 'insensitive' } },
      { wallet: { user: { name: { contains: searchTerm, mode: 'insensitive' } } } },
      { wallet: { user: { mobileNumber: { contains: searchTerm, mode: 'insensitive' } } } },
    ];
  }

  const [transactions, total] = await prisma.$transaction([
    prisma.walletTransaction.findMany({
      where: whereClause,
      include: {
        wallet: { // To get the user's details
          select: {
            user: { select: { id: true, name: true } }
          }
        }
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.walletTransaction.count({ where: whereClause }),
  ]);

  // Format the data to match your frontend's expectation
  const formattedTransactions = transactions.map(t => ({
    id: t.id,
    date: t.createdAt,
    user: t.wallet.user.name,
    userId: t.wallet.user.id,
    type: t.type,
    amount: t.type === 'DEBIT' ? -t.amount : t.amount,
    balanceAfter: t.wallet.balance, // Note: This is current balance, not historical
    admin: "Admin", // Placeholder, you may need to store this
    reason: t.description,
    status: "COMPLETED", // Placeholder
  }));
  
  // Get a list of all users who have transactions for the filter dropdown
  const usersWithTransactions = await prisma.user.findMany({
      where: { UserWallet: { transactions: { some: {} } } },
      select: { id: true, name: true }
  });

  return { 
    transactions: formattedTransactions,
    uniqueUsers: usersWithTransactions,
    totalPages: Math.ceil(total / take),
    totalTransactions: total
  };
};

// --- Function to issue a reward ---
export const issueRewardToWallet = async ({ userId, amount, description }) => {
  const transaction = prisma.$transaction(async (tx) => {
    const wallet = await tx.userWallet.update({
      where: { userId },
      data: { balance: { increment: amount } },
    });
    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount,
        type: "REWARD",
        description: description || "Reward issued by admin",
      },
    });
  });

  if (sendNotification) {
    try {
      await createNotification({
        userId: userId,
        type: 'other',
        title: `Reward Received: ₹${amount}`,
        subtitle: description || 'You received a reward!',
      });
    } catch (err) { console.error('Failed to send reward notification:', err); }
  }

  return transaction;
};

// --- Function for an admin to credit a wallet ---
export const manuallyCreditWallet = async ({ userId, amount, description, sendNotification = false }) => {
  if (typeof amount !== "number" || amount <= 0) {
    throw new AppError("Invalid credit amount.", 400);
  }

  const transaction = creditUserWallet(userId, amount, description || "Manual credit by admin" )
  // Use a transaction to ensure both operations (update wallet, create transaction record) succeed or fail together.
  // const transaction = prisma.$transaction(async (tx) => {
  //   // 1. Find the user's wallet
  //   const wallet = await tx.userWallet.findUnique({
  //     where: { userId },
  //   });

  //   if (!wallet) {
  //     throw new AppError("User wallet not found.", 404);
  //   }

  //   // 2. Update the wallet balance
  //   await tx.userWallet.update({
  //     where: { id: wallet.id },
  //     data: {
  //       balance: {
  //         increment: amount,
  //       },
  //     },
  //   });

  //   // 3. Create a transaction record for auditing
  //   const newTransaction = await tx.walletTransaction.create({
  //     data: {
  //       walletId: wallet.id,
  //       amount: amount,
  //       type: "CREDIT",
  //       description: description || "Manual credit by admin",
  //     },
  //   });

  //   return newTransaction;
  // });

  if (sendNotification) {
    try {
      await createNotification({
        userId: userId,
        type: 'other',
        title: `Wallet Credited: ₹${amount}`,
        subtitle: description || 'An admin has credited your wallet.',
      });
    } catch (err) { console.error('Failed to send credit notification:', err); }
  }

  return transaction;
};

// --- Function for an admin to debit a wallet ---
export const manuallyDebitWallet = async ({ userId, amount, description, sendNotification = false }) => {
  // Uses the same logic as the user-facing debit function
  const transaction = debitUserWallet(
    userId,
    amount,
    description || "Manual debit by admin"
  );
  if (sendNotification) {
    try {
      await createNotification({
        userId: userId,
        type: 'other',
        title: `Wallet Debited: ₹${amount}`,
        subtitle: description || 'An admin has debited your wallet.',
      });
    } catch (err) { console.error('Failed to send credit notification:', err); }
  }
  return transaction;
};


// ----- Reports Services -----

/**
 * Fetches statistics for the reports dashboard.
 */
export const getReportStats = async () => {
  // Get date for 'today'
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Define status constants based on your frontend
  // NOTE: You'll need to add 'IN_PROGRESS' and 'DISMISSED' to your Prisma schema enum
  const newReports = prisma.userReport.count({
    where: { status: 'PENDING' }, // 'PENDING' is your 'NEW'
  });

  const inProgress = prisma.userReport.count({
    where: { status: 'IN_PROGRESS' },
  });

  const resolvedToday = prisma.userReport.count({
    where: {
      status: 'RESOLVED',
      updatedAt: { gte: today }, // Assuming 'updatedAt' is changed on status update
    },
  });
  
  const falseReports = prisma.userReport.count({
      where: { status: 'DISMISSED' }
  });

  // Run all queries at the same time
  const [
    totalNew,
    totalInProgress,
    totalResolved,
    totalFalse
  ] = await prisma.$transaction([
    newReports,
    inProgress,
    resolvedToday,
    falseReports
  ]);

  return {
    newReports: { value: totalNew, trend: 0 },
    inProgress: { value: totalInProgress, trend: 0 },
    resolvedToday: { value: totalResolved, trend: 0 },
    falseReports: { value: totalFalse, trend: 0 },
  };
};

/**
 * Fetches all reports with filtering and pagination.
 */
export const fetchAllReports = async (query) => {
  const { page = 1, limit = 10, status, type } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const whereClause = {};
  if (status) whereClause.status = status;
  if (type) whereClause.reason = type; // Assuming 'type' maps to 'reason'

  const [reports, total] = await prisma.$transaction([
    prisma.userReport.findMany({
      where: whereClause,
      include: {
        reporter: { select: { id: true, name: true } },
        reported: { select: { id: true, name: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userReport.count({ where: whereClause }),
  ]);

  return { 
    reports,
    totalPages: Math.ceil(total / take),
    totalReports: total
  };
};

/**
 * Gets a count of reports grouped by reason/type.
 */
export const getReportBreakdown = async () => {
  const breakdown = await prisma.userReport.groupBy({
    by: ['reason'],
    _count: {
      reason: true,
    },
    orderBy: {
      _count: {
        reason: 'desc',
      },
    },
  });

  // Format for the frontend (e.g., for a chart)
  return breakdown.map(item => ({
    name: item.reason,
    count: item._count.reason,
  }));
};

// Helper function to format milliseconds into a readable string
const formatDuration = (ms) => {
  if (ms === null || isNaN(ms) || ms === 0) return 'N/A';
  if (ms < 60000) return `${Math.round(ms / 1000)} seconds`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} minutes`;
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)} hours`;
  return `${(ms / 86400000).toFixed(1)} days`;
};

/**
 * Calculates average, min, and max resolution times for reports.
 */
export const getResolutionTimeStats = async () => {
  // This query calculates the difference between updatedAt and createdAt in seconds
  const result = await prisma.$queryRaw`
    SELECT 
      AVG(EXTRACT(EPOCH FROM "updatedAt" - "createdAt")) AS avg,
      MIN(EXTRACT(EPOCH FROM "updatedAt" - "createdAt")) AS min,
      MAX(EXTRACT(EPOCH FROM "updatedAt" - "createdAt")) AS max
    FROM "UserReport"
    WHERE "status" = 'RESOLVED'
  `;
  
  const stats = result[0] || { avg: 0, min: 0, max: 0 };

  // Convert seconds (from EPOCH) to milliseconds for the helper function
  const avgMs = stats.avg ? stats.avg * 1000 : null;
  const minMs = stats.min ? stats.min * 1000 : null;
  const maxMs = stats.max ? stats.max * 1000 : null;

  // Format the data to perfectly match your frontend's needs
  return [
    { label: 'Average resolution time', value: formatDuration(avgMs) },
    { label: 'Fastest resolution', value: formatDuration(minMs), color: 'tw-text-green-600' },
    { label: 'Slowest resolution', value: formatDuration(maxMs), color: 'tw-text-red-600' }
  ];
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
  if (!["PENDING", "RESOLVED", "IN_PROGRESS", "DISMISSED"].includes(status)) {
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
      { name: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { mobileNumber: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.status) {
    if (query.status === "ACTIVE") whereClause.isSuspended = false;
    if (query.status === "SUSPENDED") whereClause.isSuspended = true;
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
      authMethod: "MOBILE_OTP", // Or a default method
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
  const {
    page = 1,
    limit = 10,
    status,
    type,
    category,
    subcategory,
    city,
    dateFrom,
    dateTo,
    search,
  } = query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // --- Dynamic WHERE conditions ---
  const whereClause = {};

  // ✅ Filter by status (active, cancelled, etc.)
  if (status && status !== "ALL") {
    whereClause.status = status.toUpperCase();
  }

  // ✅ Filter by type (instant, planned)
  if (type && type !== "ALL") {
    whereClause.type = type.toLowerCase();
  }

  // ✅ Filter by category / subcategory
  if (category && category !== "ALL") {
    whereClause.category = category;
  }

  if (subcategory && subcategory !== "ALL") {
    whereClause.subcategory = subcategory;
  }

  // ✅ Filter by city / locationName (case-insensitive)
  if (city) {
    whereClause.locationName = {
      contains: city,
      mode: "insensitive",
    };
  }

  // ✅ Safe date parsing
  const parsedFrom = dateFrom && !isNaN(Date.parse(dateFrom)) ? new Date(dateFrom) : null;
  const parsedTo = dateTo && !isNaN(Date.parse(dateTo)) ? new Date(dateTo) : null;

  if (parsedFrom || parsedTo) {
    whereClause.date = {};
    if (parsedFrom) whereClause.date.gte = parsedFrom;
    if (parsedTo) whereClause.date.lte = parsedTo;
  }


  // ✅ Search by category, subcategory, or locationName
  if (search) {
    whereClause.OR = [
      { category: { contains: search, mode: "insensitive" } },
      { subcategory: { contains: search, mode: "insensitive" } },
      { locationName: { contains: search, mode: "insensitive" } },
    ];
  }

  // --- Fetch data + total count atomically ---
  const [meetups, total] = await prisma.$transaction([
    prisma.meetup.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true } },
        JoinRequest: {
          where: { status: "ACCEPTED" },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),

    prisma.meetup.count({ where: whereClause }),
  ]);

  // --- Map participant count ---
  const meetupsWithCount = meetups.map((meetup) => ({
    ...meetup,
    participantCount: meetup.JoinRequest.length,
  }));

  return {
      meetups: meetupsWithCount,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / take),
        totalItems: total,
        limit: take,
      },
    };
};

/**
 * Creates a new meetup from the admin panel.
 * @param {object} meetupData - The data for the new meetup.
 */
export const scheduleMeetupByAdmin = async (meetupData) => {
  // You'll need to decide which user to assign as the creator,
  // or you could have a generic "system" user for admin-created meetups.
  if (!meetupData.createdBy) {
    throw new AppError(
      "A 'createdBy' userId is required to schedule a meetup.",
      400
    );
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
    where: { type: "REWARD" },
  });

  const referralRewards = await prisma.walletTransaction.aggregate({
    _sum: { amount: true },
    where: { type: "REWARD", description: { contains: "referral" } },
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
    {
      date: "2025-09-15",
      rewardType: "Referral Reward",
      previousAmount: 10,
      newAmount: 5,
      changedBy: "Admin",
      reason: "Cost optimization",
    },
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
      type: "REWARD",
      description: { contains: "referral" },
    },
  });

  // This is a more complex query to find the top referrer
  const topReferrers = await prisma.user.groupBy({
    by: ["referredById"],
    _count: {
      referredById: true,
    },
    where: { referredById: { not: null } },
    orderBy: {
      _count: {
        referredById: "desc",
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
    referredById: { not: null },
  };

  // Example filter by status
  if (query.status === "COMPLETED") whereClause.isVerified = true;
  if (query.status === "PENDING") whereClause.isVerified = false;

  const referredUsers = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      createdAt: true,
      isVerified: true,
      referredById: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Now, fetch the referrer details for each
  const referrerIds = [...new Set(referredUsers.map((u) => u.referredById))];
  const referrers = await prisma.user.findMany({
    where: { id: { in: referrerIds } },
    select: { id: true, name: true },
  });

  const referrersMap = new Map(referrers.map((r) => [r.id, r]));

  return referredUsers.map((user) => ({
    referredUser: { id: user.id, name: user.name },
    referrer: referrersMap.get(user.referredById),
    date: user.createdAt,
    status: user.isVerified ? "COMPLETED" : "PENDING VERIFICATION",
    // You would look up the reward amount from the transaction table in a full implementation
    rewardAmount: user.isVerified ? 5 : 0, // Placeholder
  }));
};
