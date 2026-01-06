import cron from 'node-cron';
import { processDueNotifications } from '../services/notification.service.js';

export const initCronJobs = () => {
  console.log('Notification Scheduler Initialized...');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processDueNotifications();
    } catch (error) {
      console.error('Error in notification cron:', error);
    }
  });
};