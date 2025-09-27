import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { profileUpload } from '../config/cloudinary.js';
import { uploadProfilePhoto, uploadUserPictures } from '../controllers/upload.controller.js';

const router = Router();

// Route to upload a single profile photo
// The frontend should send the file with the field name 'profilePhoto'
router.post(
  '/profile-photo',
  requireAuth,
  profileUpload.single('profilePhoto'),
  uploadProfilePhoto
);

// Route to upload up to 4 additional pictures
// The frontend should send the files with the field name 'pictures'
router.post(
  '/pictures',
  requireAuth,
  profileUpload.array('pictures', 4), // 'pictures' is the field name, 4 is the max count
  uploadUserPictures
);

export default router;