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
