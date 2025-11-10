import prisma from "../config/db.js";
import AppError from "../utils/appError.js";

/**
 * Creates a new banner.
 * @param {string} title - The title of the banner.
 * @param {string} imageUrl - The URL of the uploaded image.
 */
export const createBanner = async (title, imageUrl) => {
  if (!title || !imageUrl) {
    throw new AppError("Title and image URL are required.", 400);
  }
  return prisma.banner.create({
    data: {
      title,
      imageUrl,
    },
  });
};

/**
 * Fetches all active banners to be displayed in the app.
 */
export const getActiveBanners = async () => {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Deletes a banner. (Admin only)
 * @param {string} bannerId - The ID of the banner to delete.
 */
export const deleteBanner = async (bannerId) => {
  try {
    return await prisma.banner.delete({
      where: { id: bannerId },
    });
  } catch (err) {
    // Prisma throws if record doesn't exist
    if (err.code === "P2025") {
      throw new AppError("Banner not found.", 404);
    }
    throw err; // unexpected error → 500
  }
};

// Helper function to extract the public_id from a full Cloudinary URL
const getPublicIdFromUrl = (url) => {
  try {
    const parts = url.split('/');
    // Assumes URL format: .../upload/v12345/folder/public_id.jpg
    const publicIdWithExtension = parts.slice(-2).join('/');
    const publicId = publicIdWithExtension.split('.').slice(0, -1).join('.');
    return publicId;
  } catch (e) {
    console.error('Could not parse public_id from URL:', url, e);
    return null;
  }
};

/**
 * Updates an existing banner.
 * @param {string} bannerId - The ID of the banner to update.
 * @param {object} updateData - Data to update: { title, isActive, newImageUrl }
 */
export const updateBanner = async (bannerId, updateData) => {
  const { title, isActive, newImageUrl } = updateData;

  // 1. Find the banner to get the old image URL
  const existingBanner = await prisma.banner.findUnique({
    where: { id: bannerId },
  });
  if (!existingBanner) {
    throw new AppError('Banner not found', 404);
  }

  const dataToUpdate = {};

  // 2. Build the update object with whatever was provided
  if (title) {
    dataToUpdate.title = title;
  }
  if (isActive !== undefined) {
    // Convert string 'true'/'false' from form-data to boolean
    dataToUpdate.isActive = (isActive === 'true' || isActive === true);
  }
  if (newImageUrl) {
    dataToUpdate.imageUrl = newImageUrl;
  }

  // 3. If a new image was uploaded, delete the old one from Cloudinary
  if (newImageUrl && existingBanner.imageUrl) {
    const oldPublicId = getPublicIdFromUrl(existingBanner.imageUrl);
    if (oldPublicId) {
      console.log(`Deleting old banner image: ${oldPublicId}`);
      // Fire-and-forget deletion. No need to wait for this.
      cloudinary.uploader.destroy(oldPublicId, (error, result) => {
        if (error) console.error('Failed to delete old banner image from Cloudinary:', error);
      });
    }
  }

  // 4. Update the banner in the database
  return prisma.banner.update({
    where: { id: bannerId },
    data: dataToUpdate,
  });
};