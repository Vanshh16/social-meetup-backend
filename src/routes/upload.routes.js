import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import upload from '../config/cloudinary.js';
import { uploadProfilePhoto, uploadUserPictures } from '../controllers/upload.controller.js';

const router = Router();

// Route to upload a single profile photo
// The frontend should send the file with the field name 'profilePhoto'
router.post(
  '/profile-photo',
  requireAuth,
  upload.single('profilePhoto'),
  uploadProfilePhoto
);

// Route to upload up to 2 additional pictures
// The frontend should send the files with the field name 'pictures'
router.post(
  '/pictures',
  requireAuth,
  upload.array('pictures', 2), // 'pictures' is the field name, 2 is the max count
  uploadUserPictures
);

export default router;