import { Queue, Worker } from 'bullmq';
import redisClient from '../config/redis.js'; // We'll use the same Redis connection
import { saveMessage } from '../services/chat.service.js';

const QUEUE_NAME = 'message-queue';

// The "Queue" is what you add jobs to.
export const messageQueue = new Queue(QUEUE_NAME, {
  connection: redisClient,
});

// The "Worker" is what processes the jobs.
new Worker(QUEUE_NAME, async (job) => {
  const { chatId, senderId, content } = job.data;
  try {
    console.log(`✍️  Worker processing job: Saving message to chat ${chatId}`);
    await saveMessage(chatId, senderId, content);
  } catch (error) {
    console.error(`Error processing message job for chat ${chatId}:`, error);
    // You can add more advanced retry logic here if needed
  }
}, { connection: redisClient });

console.log('Message worker is running...');