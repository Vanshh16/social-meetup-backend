import { createBanner, getActiveBanners, deleteBanner, updateBanner } from '../services/banner.service.js';

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

export const updateBannerController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, isActive } = req.body; // Get text fields from the form-data body

    const updateData = {
      title,
      isActive,
    };

    // If a new image file was uploaded, add its Cloudinary path to updateData
    if (req.file) {
      updateData.newImageUrl = req.file.path;
    }

    const updatedBanner = await updateBanner(id, updateData);
    res.status(200).json({ success: true, data: updatedBanner });
  } catch (error) {
    next(error);
  }
};