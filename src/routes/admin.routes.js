import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';
import {
  getAllUsers,
  updateUserStatus,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getReferralReward,
  setReferralReward,
  getReportDetails,
  updateReportStatus,
  getDashboardStats,
  getAllSettings,
  updateAllSettings,
  sendNotificationController,
  sendBulkNotificationController,
  sendGlobalNotificationController,
  issueRewardController,
  debitWalletController,
  getAllMeetupsController,
  scheduleMeetupController,
  editMeetupByAdminController,
  searchUsersController,
  createUserController,
  exportUsersController,
  getRewardStatsController,
  getRewardHistoryController,
  getReferralStatsController,
  getReferralHistoryController,
  adminLoginController,
  getUserDetailsController,
  getCategoryStatsController,
  getWalletStatsController,
  getAllTransactionsController,
  creditWalletController,
  getReportStatsController,
  getAllReportsController,
  getReportBreakdownController,
  getResolutionStatsController,
  getSuspensionHistoryController,
} from '../controllers/admin.controller.js';
import {
  createCityController,
  updateCityStatusController,
  getLocationsController,
} from '../controllers/location.controller.js';
import { categoryUpload } from '../config/cloudinary.js'; // Import the new config

const router = Router();

// --- Public Admin Route ---
// Admin Login (does not require auth)
router.post('/login', adminLoginController);

// --- Protected Admin Routes ---
// All routes below this line will require an authenticated admin token
// Middleware to ensure all routes in this file are accessed only by admins
router.use(requireAuth, requireRole(['ADMIN']));

// --- User Management ---
router.get('/users', getAllUsers);
router.get('/users/:userId', getUserDetailsController);
router.put('/users/:userId/status', updateUserStatus);

// --- Category Management ---
router.get('/categories', getAllCategories);
// router.post('/categories', createCategory);
// router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);
router.get('/categories/stats', getCategoryStatsController);
router.post(
    '/categories', 
    categoryUpload.single('image'), // 'image' must match Frontend FormData key
    createCategory
);
router.put(
    '/categories/:id', 
    categoryUpload.single('image'), 
    updateCategory
);

// --- Settings & Wallet Management ---
router.get('/settings/referral-reward', getReferralReward);
router.put('/settings/referral-reward', setReferralReward);

// --- Report Management ---
router.get('/reports', getAllReportsController);
router.get('/reports/stats', getReportStatsController);
router.get('/reports/stats/resolution', getResolutionStatsController);
router.get('/reports/breakdown', getReportBreakdownController);
router.get('/reports/:id', getReportDetails);
router.put('/reports/:id/status', updateReportStatus);

// --- App-Wide Settings ---
// router.get('/settings', getAllSettings);
// router.put('/settings', updateAllSettings);

// --- Analytics ---
router.get('/stats/dashboard', getDashboardStats);

// --- Notifications ---
router.post('/users/:userId/notify', sendNotificationController);
router.post('/users/notify/bulk', sendBulkNotificationController);
router.post('/notify/all', sendGlobalNotificationController);

// --- Wallet Management ---
router.post('/users/:userId/wallet/credit', creditWalletController);
router.post('/users/:userId/wallet/reward', issueRewardController);
router.post('/users/:userId/wallet/debit', debitWalletController);
router.get('/wallet/stats', getWalletStatsController);
router.get('/wallet/transactions', getAllTransactionsController);

// // -----------------------LATESTTTT -----------------

// --- User Management ---
router.get('/users', searchUsersController); // This now handles both getting all users and searching
router.post('/users', createUserController);
router.get('/users/export', exportUsersController);
router.put('/users/:userId/status', updateUserStatus);
router.get('/suspensions/history', getSuspensionHistoryController);

// --- Meetup Management ---
router.get('/meetups', getAllMeetupsController);
router.post('/meetups', scheduleMeetupController);
router.put('/meetups/:id', editMeetupByAdminController);
 
// --- Location Management ---
router.get('/locations', getLocationsController);
router.post('/locations/city', createCityController);
router.put('/locations/city/:id/status', updateCityStatusController);
 
// --- Settings & Rewards ---
router.get('/settings', getAllSettings);
router.put('/settings', updateAllSettings); // Reused for all reward settings

router.get('/rewards/stats', getRewardStatsController);
router.get('/rewards/history', getRewardHistoryController);

// --- Referral Tracking ---
router.get('/referrals/stats', getReferralStatsController);
router.get('/referrals/history', getReferralHistoryController);

export default router;