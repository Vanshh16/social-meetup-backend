import { blockUser, unblockUser, getBlockedUsers } from '../services/user.service.js';

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