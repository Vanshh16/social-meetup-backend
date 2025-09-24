import prisma from '../config/db.js';

/**
 * Updates the user's profile photo URL in the database.
 * @param {string} userId - The ID of the user.
 * @param {string} imageUrl - The URL of the uploaded image from Cloudinary.
 */
export const updateUserProfilePhoto = async (userId, imageUrl) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePhoto: imageUrl },
      select: { id: true, profilePhoto: true },
    });

    if (!updatedUser) {
      throw new AppError('User not found.', 404);
    }

    return updatedUser;
  } catch (error) {
    throw new AppError(error.message || 'Failed to update profile photo.', 500);
  }
};
 
/**
 * Adds additional picture URLs to the user's profile.
 * @param {string} userId - The ID of the user.
 * @param {string[]} imageUrls - An array of URLs from Cloudinary.
 */
export const addUserPictures = async (userId, imageUrls) => {
  
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pictures: true },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const updatedPictures = [...(user.pictures || []), ...imageUrls].slice(0, 2);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { pictures: updatedPictures },
      select: { id: true, pictures: true },
    });

    return updatedUser;
  } catch (error) {
    throw new AppError(error.message || 'Failed to add user pictures.', 500);
  }
};