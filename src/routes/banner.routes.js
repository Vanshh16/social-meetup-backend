import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import { bannerUpload } from '../config/cloudinary.js';
import { createBannerController, deleteBannerController, getBannersController } from '../controllers/banner.controller.js';

const router = Router();

// --- Public Route for Frontend ---
// Anyone can view the active banners
router.get('/', getBannersController);


// --- Admin-Only Routes ---
// Only admins can create or delete banners
router.post(
    '/', 
    requireAuth, 
    requireRole(['ADMIN']), 
    bannerUpload.single('image'), // 'image' is the field name for the file
    createBannerController
);

router.delete(
    '/:id', 
    requireAuth, 
    requireRole(['ADMIN']), 
    deleteBannerController
);

export default router;