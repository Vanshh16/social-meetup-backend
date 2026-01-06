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
  loginAdminWithPassword,
  getUserDetailsById,
  getCategoryDashboardStats,
  getWalletDashboardStats,
  getAllWalletTransactions,
  getReportBreakdown,
  getReportStats,
  getResolutionTimeStats,
  getSuspensionHistory,
  getCampaignHistory,
  scheduleNotification,
} from "../services/admin.service.js";
import { updateMeetup } from '../services/meetup.service.js'; // Reusing user-facing service
import AppError from "../utils/appError.js";
import { generateToken } from "../utils/jwt.js";

/**
 * Handles admin login request.
 */
export const adminLoginController = async (req, res, next) => {
  try {
    const { mobileNumber, password } = req.body;
    const adminUser = await loginAdminWithPassword(mobileNumber, password);

    // Generate a token for the admin
    const token = generateToken({
      id: adminUser.id,
      role: adminUser.role,
      name: adminUser.name,
    });

    res.status(200).json({ success: true, data: { user: adminUser, token } });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await fetchAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const getUserDetailsController = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await getUserDetailsById(userId);
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const adminId = req.user.id; // Get the admin's ID from the token
    
    // req.body now contains { isSuspended: true/false, reason: '...' }
    const updatedUser = await modifyUserStatus(adminId, userId, req.body);
    
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};

export const getSuspensionHistoryController = async (req, res, next) => {
  try {
    const data = await getSuspensionHistory(req.query);
    res.status(200).json({ success: true, data });
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
    // 1. Get the Image URL from Cloudinary (if uploaded)
    const image = req.file ? req.file.path : null;

    // 2. Extract body data
    let { name, subcategories } = req.body;

    // 3. PARSE SUBCATEGORIES
    // Since this comes as 'multipart/form-data', array/objects are strings.
    if (subcategories && typeof subcategories === 'string') {
        try {
            subcategories = JSON.parse(subcategories);
        } catch (e) {
            return res.status(400).json({ success: false, message: "Invalid subcategories format" });
        }
    }

    const newCategory = await addNewCategory(name, image, subcategories);
    res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    let { name, subcategories } = req.body;

    // 1. Prepare Update Object
    const updateData = {};
    if (name) updateData.name = name;

    // 2. Handle Image: Only update if a NEW file is provided
    if (req.file) {
      updateData.image = req.file.path;
    }

    // 3. Handle Subcategories: Parse if string
    if (subcategories) {
        if (typeof subcategories === 'string') {
            try {
                updateData.subcategories = JSON.parse(subcategories);
            } catch (e) {
                 return res.status(400).json({ success: false, message: "Invalid subcategories format" });
            }
        } else {
             updateData.subcategories = subcategories;
        }
    }

    const updatedCategory = await modifyCategory(id, updateData);
    res.status(200).json({ success: true, data: updatedCategory });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await removeCategory(id);
    res.status(200).json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    // res.status(200).json({ success: false, message: error.message });
    next(error);
  }
};

export const getCategoryStatsController = async (req, res, next) => {
    try {
        const stats = await getCategoryDashboardStats();
        res.status(200).json({ success: true, data: stats });
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

export const creditWalletController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, description, sendNotification } = req.body;
    const transaction = await manuallyCreditWallet({
      userId,
      amount,
      description,
      sendNotification
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
        const { amount, description, sendNotification } = req.body;
        const transaction = await issueRewardToWallet({ userId, amount, description, sendNotification });
        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        next(error);
    }
};

export const debitWalletController = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { amount, description, sendNotification } = req.body;
        const transaction = await manuallyDebitWallet({ userId, amount, description, sendNotification });
        res.status(200).json({ success: true, data: transaction });
    } catch (error) {
        next(error);
    }
};

export const getWalletStatsController = async (req, res, next) => {
  try {
    const stats = await getWalletDashboardStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getAllTransactionsController = async (req, res, next) => {
  try {
    const data = await getAllWalletTransactions(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ----- Reports Controller ------ //

export const getReportStatsController = async (req, res, next) => {
  try {
    const stats = await getReportStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const getAllReportsController = async (req, res, next) => {
  try {
    const data = await fetchAllReports(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getReportBreakdownController = async (req, res, next) => {
  try {
    const data = await getReportBreakdown();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getResolutionStatsController = async (req, res, next) => {
  try {
    const data = await getResolutionTimeStats();
    res.status(200).json({ success: true, data });
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

/**
 * Creates a new scheduled notification campaign.
 * Handles image upload and target parsing.
 */
export const createNotificationCampaign = async (req, res, next) => {
  try {
    // 1. Handle Image Upload (from Multer)
    const image = req.file ? req.file.path : null;

    // 2. Extract Data
    const { title, message, targetCityId, targetGender, scheduledAt } = req.body;

    // 3. Validation
    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and Message are required." });
    }

    // 4. Call Service
    const campaign = await scheduleNotification(req.user.id, {
      title,
      message,
      image,
      targetCityId, // "ALL" or UUID
      targetGender, // "ALL", "MALE", "FEMALE"
      scheduledAt
    });

    res.status(201).json({ 
      success: true, 
      message: "Notification scheduled successfully.", 
      data: campaign 
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Fetches the history of all notification campaigns.
 */
export const getCampaigns = async (req, res, next) => {
  try {
    const campaigns = await getCampaignHistory();
    res.status(200).json({ success: true, data: campaigns });
  } catch (error) {
    next(error);
  }
};


// ------------------ LATEST -----------------------


export const searchUsersController = async (req, res, next) => {
    try {
        const result = await searchUsers(req.query);
        res.status(200).json({ success: true, data: result });
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
        const data = await fetchAllMeetups(req.query);
        res.status(200).json({ success: true, data });
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