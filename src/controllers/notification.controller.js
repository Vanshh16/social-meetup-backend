import * as NotificationService from '../services/notification.service.js';

export const getNotifications = async (req, res, next) => {
  try {
    const { notifications, unreadCount, totalPages } = await NotificationService.getNotifications(req.user.id, req.query);
    res.status(200).json({ success: true, unreadCount, totalPages, notifications });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const result = await NotificationService.markAllAsRead(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const result = await NotificationService.deleteNotification(req.params.id, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteAllNotifications = async (req, res, next) => {
  try {
    const result = await NotificationService.deleteAllNotifications(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await NotificationService.getUnreadCount(req.user.id);
    res.status(200).json({ success: true, unreadCount: count });
  } catch (error) {
    next(error);
  }
};