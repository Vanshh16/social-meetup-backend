import prisma from "../config/db.js";
import AppError from "../utils/appError.js";
import { calculateAge } from "../utils/helper.js";


/**
 * Fetches the complete profile for the currently logged-in user.
 * @param {string} userId - The ID of the logged-in user.
 */
export const getMyProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    // Select all fields, including sensitive ones, as only the user themselves can access this
    select: {
      id: true,
      name: true,
      email: true,
      mobileNumber: true,
      profilePhoto: true,
      gender: true,
      dateOfBirth: true,
      city: true,
      bio: true,
      hobbies: true,
      pictures: true,
      referredById: true,
      religion: true,
      Meetup: true

      // Add any other fields you want the user to see
    },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return user;
};

/**
 * Updates the profile for the currently logged-in user.
 * @param {string} userId - The ID of the logged-in user.
 * @param {object} updateData - The data to update.
 */
export const updateMyProfile = async (userId, updateData) => {
  // You can add validation here to prevent users from updating certain fields
  // For example, you might not want them to change their email or mobile number here.
  
  return prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
};


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
      Meetup: {
        // Include the meetups created by this user
        orderBy: {
          createdAt: "desc",
        },
        take: 5, // Limit to the 5 most recent meetups
      },
    },
  });

  if (!user) {
    throw new AppError("User not found.", 404);
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
    throw new AppError("User not found.", 404);
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
    throw new AppError("You cannot block yourself.", 400);
  }
  return prisma.userBlock.create({
    data: {
      blockerId,
      blockedId,
    },
  });
};

export const unblockUser = async (blockerId, blockedId) => {
  try {
    return await prisma.userBlock.delete({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
    });
  } catch (err) {
    throw new AppError("Block record not found.", 404);
  }
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
