import prisma from '../config/db.js';

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
    throw new Error('Invalid reward amount.');
  }
  return prisma.appSettings.upsert({
    where: { key: REFERRAL_REWARD_KEY },
    update: { value: amount.toString() },
    create: { key: REFERRAL_REWARD_KEY, value: amount.toString() },
  });
};

export const manuallyCreditWallet = async ({ userId, amount, description }) => {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Invalid credit amount.');
  }

  // Use a transaction to ensure both operations (update wallet, create transaction record) succeed or fail together.
  return prisma.$transaction(async (tx) => {
    // 1. Find the user's wallet
    const wallet = await tx.userWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new Error('User wallet not found.');
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
    throw new Error('Report not found.');
  }
  return report;
};

export const modifyReportStatus = async (reportId, status) => {
  // Add validation to ensure status is one of the allowed enum values
  if (!['PENDING', 'RESOLVED', 'ACTION_TAKEN'].includes(status)) {
    throw new Error('Invalid status provided.');
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