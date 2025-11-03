import { updateUserProfilePhoto, addUserPictures } from '../services/upload.service.js';

export const uploadProfilePhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded.');
    }
    const imageUrl = req.file.path; // URL from Cloudinary
    const updatedUser = await updateUserProfilePhoto(req.user.id, imageUrl);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};

export const uploadUserPictures = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      throw new Error('No files uploaded.');
    }
    // req.files is an array of uploaded file objects
    const imageUrls = req.files.map(file => file.path);
    const updatedUser = await addUserPictures(req.user.id, imageUrls);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};

// --- Controller for chat image uploads ---
export const uploadChatImageController = (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded.');
    }
    // Just return the URL from Cloudinary
    res.status(200).json({ success: true, url: req.file.path });
  } catch (error) {
    next(error);
  }
};

// --- Controller for chat voice uploads ---
export const uploadChatVoiceController = (req, res, next) => {
  try {
    if (!req.file) {
      throw new Error('No voice note file uploaded.');
    }
    // Just return the URL from Cloudinary
    res.status(200).json({ success: true, url: req.file.path });
  } catch (error) {
    next(error);
  }
};