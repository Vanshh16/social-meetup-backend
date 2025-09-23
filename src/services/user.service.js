import prisma from '../config/db.js';
import { calculateAge } from '../utils/helper.js';


/**
 * Fetches a public profile for a given user.
 * @param {string} userId - The ID of the user whose profile is being requested.
 */
export const getUserProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      profilePhoto: true,
      gender: true,
      city: true,
      bio: true,
      hobbies: true,
      pictures: true,
      dateOfBirth: true, 
      Meetup: { // Include the meetups created by this user
        orderBy: {
          createdAt: 'desc',
        },
        take: 5, // Limit to the 5 most recent meetups
      },
    },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  // Calculate age and remove the dateOfBirth from the final object for privacy
  const { dateOfBirth, ...userProfile } = user;
  userProfile.age = calculateAge(dateOfBirth);

  return userProfile;
};


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