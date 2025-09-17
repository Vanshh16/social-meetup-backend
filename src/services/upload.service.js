import prisma from '../config/db.js';

/**
 * Updates the user's profile photo URL in the database.
 * @param {string} userId - The ID of the user.
 * @param {string} imageUrl - The URL of the uploaded image from Cloudinary.
 */
export const updateUserProfilePhoto = async (userId, imageUrl) => {
  return prisma.user.update({
    where: { id: userId },
    data: { profilePhoto: imageUrl },
    select: { id: true, profilePhoto: true },
  });
};

/**
 * Adds additional picture URLs to the user's profile.
 * @param {string} userId - The ID of the user.
 * @param {string[]} imageUrls - An array of URLs from Cloudinary.
 */
export const addUserPictures = async (userId, imageUrls) => {
  // Fetches the user's current pictures
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pictures: true },
  });

  // Combines old pictures with new ones, ensuring not to exceed the limit (e.g., 2)
  const updatedPictures = [...(user.pictures || []), ...imageUrls].slice(0, 2);

  return prisma.user.update({
    where: { id: userId },
    data: { pictures: updatedPictures },
    select: { id: true, pictures: true },
  });
};