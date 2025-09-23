import prisma from '../config/db.js';

/**
 * Adds an FCM token to a user's record, ensuring no duplicates.
 * @param {string} userId - The ID of the logged-in user.
 * @param {string} fcmToken - The FCM token from the device.
 */
export const registerFcmToken = async (userId, fcmToken) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fcmTokens: true },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  // Add the new token only if it's not already in the list
  const tokens = new Set(user.fcmTokens);
  tokens.add(fcmToken);

  return prisma.user.update({
    where: { id: userId },
    data: { fcmTokens: Array.from(tokens) },
  });
};

export const blockUser = async (blockerId, blockedId) => {
  if (blockerId === blockedId) {
    throw new Error('You cannot block yourself.');
  }
  return prisma.userBlock.create({
    data: {
      blockerId,
      blockedId,
    },
  });
};

export const unblockUser = async (blockerId, blockedId) => {
  return prisma.userBlock.delete({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId,
      },
    },
  });
};

export const getBlockedUsers = async (blockerId) => {
  return prisma.userBlock.findMany({
    where: { blockerId },
    select: {
      blocked: {
        select: {
          id: true,
          name: true,
          profilePhoto: true,
        },
      },
    },
  });
};