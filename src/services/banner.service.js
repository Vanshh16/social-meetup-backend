import prisma from "../config/db.js";

/**
 * Creates a new banner.
 * @param {string} title - The title of the banner.
 * @param {string} imageUrl - The URL of the uploaded image.
 */
export const createBanner = async (title, imageUrl) => {
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
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Deletes a banner. (Admin only)
 * @param {string} bannerId - The ID of the banner to delete.
 */
export const deleteBanner = async (bannerId) => {
  return prisma.banner.delete({
    where: { id: bannerId },
  });
};