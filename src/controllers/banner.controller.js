import { createBanner, getActiveBanners, deleteBanner } from '../services/banner.service.js';

// --- Admin Controllers ---
export const createBannerController = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error('Banner image is required.');
    }
    const { title } = req.body;
    const imageUrl = req.file.path; // URL from Cloudinary
    const banner = await createBanner(title, imageUrl);
    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
};

export const deleteBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteBanner(id);
    res.status(200).json({ success: true, message: 'Banner deleted successfully.' });
  } catch (error) {
    next(error);
  }
};


// --- Public Controller ---
export const getBannersController = async (req, res, next) => {
  try {
    const banners = await getActiveBanners();
    res.status(200).json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
};