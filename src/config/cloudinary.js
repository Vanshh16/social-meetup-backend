import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer to use Cloudinary for storage
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'social-meetup-profiles', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => `user-${req.user.id}-${Date.now()}`,
  },
});

// Create the Multer upload instance
const upload = multer({ storage: storage });

export default upload;

// --- Storage for User Profile Pictures ---
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'social-meetup-profiles',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => `user-${req.user.id}-${Date.now()}`,
  },
});
export const profileUpload = multer({ storage: profileStorage });


// --- NEW: Storage for Banners ---
const bannerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'banners', // Store banners in a separate folder
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif'],
    public_id: (req, file) => `banner-${Date.now()}`,
  },
});
export const bannerUpload = multer({ storage: bannerStorage });