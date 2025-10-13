import IORedis from 'ioredis';

// Create a new Redis client instance.
// It will automatically use the REDIS_URL from your environment variables in production.
const redisClient = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // This is important for BullMQ later
});

redisClient.on('connect', () => console.log('Redis client connected.'));
redisClient.on('error', (err) => console.error('Redis connection error:', err));

export default redisClient;