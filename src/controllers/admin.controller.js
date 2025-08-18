import {
  fetchAllUsers,
  modifyUserStatus,
  addNewCategory,
  modifyCategory,
  removeCategory,
  fetchAllCategories,
  modifyReportStatus,
  fetchReportDetails,
  fetchAllReports,
  manuallyCreditWallet,
  updateReferralReward,
  fetchReferralReward,
  fetchDashboardStats,
  fetchAllSettings,
  updateSettings,
} from '../services/admin.service.js';

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await fetchAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const updateData = req.body; // e.g., { isVerified: true, role: 'MODERATOR' }

    const updatedUser = await modifyUserStatus(userId, updateData);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};

export const getAllCategories = async (req, res, next) => {
  try {
    const categories = await fetchAllCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, subcategories } = req.body; // subcategories is an array of strings
    const newCategory = await addNewCategory(name, subcategories);
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedCategory = await modifyCategory(id, name);
    res.status(200).json({ success: true, data: updatedCategory });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await removeCategory(id);
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// --- New Wallet & Settings Controller Functions ---

export const getReferralReward = async (req, res, next) => {
  try {
    const reward = await fetchReferralReward();
    res.status(200).json({ success: true, data: { amount: reward } });
  } catch (error) {
    next(error);
  }
};

export const setReferralReward = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const setting = await updateReferralReward(amount);
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

export const creditUserWallet = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, description } = req.body;
    const transaction = await manuallyCreditWallet({ userId, amount, description });
    res.status(200).json({ success: true, data: transaction });
  } catch (error)
 {
    next(error);
  }
};

export const getReports = async (req, res, next) => {
  try {
    const reports = await fetchAllReports();
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
};

export const getReportDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await fetchReportDetails(id);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const updateReportStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // e.g., "RESOLVED" or "ACTION_TAKEN"
    const updatedReport = await modifyReportStatus(id, status);
    res.status(200).json({ success: true, data: updatedReport });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await fetchDashboardStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getAllSettings = async (req, res, next) => {
  try {
    const settings = await fetchAllSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateAllSettings = async (req, res, next) => {
  try {
    // req.body will be an object like { "REFERRAL_REWARD_AMOUNT": 15, "MEETUP_SEARCH_RADIUS_KM": 50 }
    await updateSettings(req.body);
    res.status(200).json({ success: true, message: 'Settings updated successfully.' });
  } catch (error) {
    next(error);
  }
};