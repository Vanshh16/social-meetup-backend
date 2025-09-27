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
  sendNotificationToUser,
  sendNotificationToMultipleUsers,
  sendNotificationToAllUsers,
  manuallyDebitWallet,
  issueRewardToWallet,
  searchUsers,
  createUserByAdmin,
  exportUsersToCsv,
  scheduleMeetupByAdmin,
  fetchAllMeetups,
  getRewardHistory,
  getRewardStats,
  getReferralStats,
  getReferralHistory,
} from "../services/admin.service.js";
import { updateMeetup } from '../services/meetup.service.js'; // Reusing user-facing service
import AppError from "../utils/appError.js";

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await fetchAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
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
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const getAllCategories = async (req, res, next) => {
  try {
    const categories = await fetchAllCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, subcategories } = req.body; // subcategories is an array of strings
    const newCategory = await addNewCategory(name, subcategories);
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
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
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await removeCategory(id);
    res
      .status(200)
      .json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

// --- New Wallet & Settings Controller Functions ---

export const getReferralReward = async (req, res, next) => {
  try {
    const reward = await fetchReferralReward();
    res.status(200).json({ success: true, data: { amount: reward } });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const setReferralReward = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const setting = await updateReferralReward(amount);
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const creditUserWallet = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, description } = req.body;
    const transaction = await manuallyCreditWallet({
      userId,
      amount,
      description,
    });
    res.status(200).json({ success: true, data: transaction });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const issueRewardController = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { amount, description } = req.body;
        const transaction = await issueRewardToWallet({ userId, amount, description });
        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        next(error);
    }
};

export const debitWalletController = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { amount, description } = req.body;
        const transaction = await manuallyDebitWallet({ userId, amount, description });
        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        next(error);
    }
};

export const getReports = async (req, res, next) => {
  try {
    const reports = await fetchAllReports();
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const getReportDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await fetchReportDetails(id);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
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
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await fetchDashboardStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const getAllSettings = async (req, res, next) => {
  try {
    const settings = await fetchAllSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const updateAllSettings = async (req, res, next) => {
  try {
    // req.body will be an object like { "REFERRAL_REWARD_AMOUNT": 15, "MEETUP_SEARCH_RADIUS_KM": 50 }
    await updateSettings(req.body);
    res
      .status(200)
      .json({ success: true, message: "Settings updated successfully." });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });    
    next(error);
  }
};

export const sendNotificationController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { title, body } = req.body;
    const result = await sendNotificationToUser(userId, title, body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const sendBulkNotificationController = async (req, res, next) => {
    try {
        const { userIds, title, body } = req.body; // Expect an array of user IDs
        const result = await sendNotificationToMultipleUsers(userIds, title, body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

export const sendGlobalNotificationController = async (req, res, next) => {
    try {
        const { title, body } = req.body;
        const result = await sendNotificationToAllUsers(title, body);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};




// ------------------ LATEST -----------------------


export const searchUsersController = async (req, res, next) => {
    try {
        const users = await searchUsers(req.query);
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        next(error);
    }
};

export const createUserController = async (req, res, next) => {
    try {
        const newUser = await createUserByAdmin(req.body);
        res.status(201).json({ success: true, data: newUser });
    } catch (error) {
        next(error);
    }
};

export const exportUsersController = async (req, res, next) => {
    try {
        const csv = await exportUsersToCsv();
        res.header('Content-Type', 'text/csv');
        res.attachment('users.csv');
        res.send(csv);
    } catch (error) {
        next(error);
    }
};

export const getAllMeetupsController = async (req, res, next) => {
    try {
        const meetups = await fetchAllMeetups(req.query);
        res.status(200).json({ success: true, data: meetups });
    } catch (error) {
        next(error);
    }
};

export const scheduleMeetupController = async (req, res, next) => {
    try {
        const newMeetup = await scheduleMeetupByAdmin(req.body);
        res.status(201).json({ success: true, data: newMeetup });
    } catch (error) {
        next(error);
    }
};

// For editing, we can reuse the existing user-facing edit logic.
// The admin has the rights, so we just need a controller.
export const editMeetupByAdminController = async (req, res, next) => {
    try {
        const { id } = req.params;
        // We pass req.user.id but the service won't use it for auth check if admin
        const updatedMeetup = await updateMeetup(id, req.user.id, req.body);
        res.status(200).json({ success: true, data: updatedMeetup });
    } catch (error) {
        next(error);
    }
};

export const getRewardStatsController = async (req, res, next) => {
    try {
        const stats = await getRewardStats();
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

export const getRewardHistoryController = async (req, res, next) => {
    try {
        const history = await getRewardHistory();
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
};

export const getReferralStatsController = async (req, res, next) => {
    try {
        const stats = await getReferralStats();
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

export const getReferralHistoryController = async (req, res, next) => {
    try {
        const history = await getReferralHistory(req.query);
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        next(error);
    }
};