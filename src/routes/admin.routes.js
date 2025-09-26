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
  creditUserWallet,
  getReports,
  getReportDetails,
  updateReportStatus,
  getDashboardStats,
  getAllSettings,
  updateAllSettings,
  sendNotificationController,
  sendBulkNotificationController,
  sendGlobalNotificationController,
} from '../controllers/admin.controller.js';

const router = Router();

// Middleware to ensure all routes in this file are accessed only by admins
router.use(requireAuth, requireRole(['ADMIN']));

// --- User Management ---
router.get('/users', getAllUsers);
router.put('/users/:userId/status', updateUserStatus);

// --- Category Management ---
router.get('/categories', getAllCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// --- Settings & Wallet Management ---
router.get('/settings/referral-reward', getReferralReward);
router.put('/settings/referral-reward', setReferralReward);
router.post('/users/:userId/wallet/credit', creditUserWallet);

// --- Report Management ---
router.get('/reports', getReports);
router.get('/reports/:id', getReportDetails);
router.put('/reports/:id/status', updateReportStatus);

// --- App-Wide Settings ---
router.get('/settings', getAllSettings);
router.put('/settings', updateAllSettings);

// --- Analytics ---
router.get('/stats/dashboard', getDashboardStats);

// --- Notifications ---
router.post('/users/:userId/notify', sendNotificationController);
router.post('/users/notify/bulk', sendBulkNotificationController);
router.post('/notify/all', sendGlobalNotificationController);

export default router;