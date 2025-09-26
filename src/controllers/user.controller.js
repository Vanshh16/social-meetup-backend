import { blockUser, unblockUser, getBlockedUsers, registerFcmToken, getUserProfile, updateMyProfile, getMyProfile } from '../services/user.service.js';

export const getMyProfileController = async (req, res, next) => {
  try {
    const userProfile = await getMyProfile(req.user.id);
    res.status(200).json({ success: true, data: userProfile });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfileController = async (req, res, next) => {
  try {
    const updatedUser = await updateMyProfile(req.user.id, req.body);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};

export const getUserProfileController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userProfile = await getUserProfile(id);
    res.status(200).json({ success: true, data: userProfile });
  } catch (error) {
    next(error);
  }
};

export const blockUserController = async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const { userId: blockedId } = req.params;
    await blockUser(blockerId, blockedId);
    res.status(200).json({ success: true, message: 'User blocked successfully.' });
  } catch (error) {
    next(error);
  }
};

export const unblockUserController = async (req, res, next) => {
  try {
    const blockerId = req.user.id;
    const { userId: blockedId } = req.params;
    await unblockUser(blockerId, blockedId);
    res.status(200).json({ success: true, message: 'User unblocked successfully.' });
  } catch (error) {
    next(error);
  }
};

export const getBlockedUsersController = async (req, res, next) => {
  try {
    const blockedList = await getBlockedUsers(req.user.id);
    res.status(200).json({ success: true, data: blockedList });
  } catch (error) {
    next(error);
  }
};


export const registerFcmTokenController = async (req, res, next) => {
  try {
    const { token } = req.body;
    await registerFcmToken(req.user.id, token);
    res.status(200).json({ success: true, message: 'FCM token registered successfully.' });
  } catch (error) {
    next(error);
  }
};