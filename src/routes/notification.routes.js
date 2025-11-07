import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadCount,
} from '../controllers/notification.controller.js';

const router = Router();
router.use(requireAuth); // All notification routes are private

// GET /api/v1/notifications
router.get('/', getNotifications);

// GET /api/v1/notifications/unread-count
router.get('/unread-count', getUnreadCount);

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', markAllAsRead);

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', markAsRead);

// DELETE /api/v1/notifications/clear-all
router.delete('/clear-all', deleteAllNotifications);

// DELETE /api/v1/notifications/:id
router.delete('/:id', deleteNotification);

export default router;