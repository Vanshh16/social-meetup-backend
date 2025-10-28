// import jwt from 'jsonwebtoken';
// import { saveMessage } from '../services/chat.service.js';
// import prisma from '../config/db.js';
// import { Server } from 'socket.io';

// export let io;

// const initializeSocket = (httpServer) => {
//   // --- Initialize io here ---
//   io = new Server(httpServer, {
//     cors: {
//       origin: "*",
//       methods: ["GET", "POST"]
//     }
//   });

//   io.use((socket, next) => {
//     let token;

//     if (socket.handshake.auth && socket.handshake.auth.token) {
//       // Modern client (e.g., socket.io-client)
//       token = socket.handshake.auth.token;
//     } else if (socket.handshake.headers && socket.handshake.headers.authorization) {
//       // Client that uses headers (e.g., Postman)
//       token = socket.handshake.headers.authorization.split(' ')[1];
//     }
//     jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
//       if (err) {
//         return next(new Error('Authentication error: Invalid token.'));
//       }
//       socket.user = user;
//       next();
//     });
//   });

//   io.on('connection', (socket) => {
//     console.log(`🔌 User connected: ${socket.id} | User ID: ${socket.user.id}`);

//     // Have each user join a private room named after their own user ID
//     socket.join(socket.user.id);

//     // Event for a user to join a specific chat room
//     socket.on('joinChat', async (message) => {
//       const { chatId } = JSON.parse(message);
//       console.log("chatIdXXXXX: ", message);

//       const isMember = await prisma.chat.findFirst({
//         where: {
//           id: chatId,
//           users: { some: { id: socket.user.id } }
//         }
//       });

//       if (isMember) {
//         socket.join(chatId);
//         console.log(`User ${socket.user.id} joined chat room: ${chatId}`);
//       } else {
//         console.log(`Unauthorized attempt by user ${socket.user.id} to join chat ${chatId}`);
//         // --- ENHANCEMENT 3: Emit Error to Client ---
//         socket.emit('error', { message: `You are not authorized to join chat ${chatId}` });
//       }
//     });

//     // Event for sending a message
//     socket.on('sendMessage', async (message) => {
//       const { chatId, content } = JSON.parse(message);
//       console.log("chatId, content", chatId, content);
//       try {
//         const senderId = socket.user.id;
//         const newMessage = await saveMessage(chatId, senderId, content);

//         // Broadcast the new message to everyone in the specific chat room
//         io.to(chatId).emit('receiveMessage', newMessage);
//       } catch (error) {
//         console.error(error);
//         socket.emit('error', { message: 'Failed to send message.' });
//       }
//     });

//     // Typing Indicators
// socket.on('typing', ({ chatId }) => {
//         // Broadcast to everyone in the chat room EXCEPT the sender
//         socket.volatile.to(chatId).emit('typing', { userId: socket.user.id });
//     });

//     socket.on('stop_typing', ({ chatId }) => {
//         socket.volatile.to(chatId).emit('stop_typing', { userId: socket.user.id });
//     });
//     socket.on('disconnect', () => {
//       console.log(`User disconnected: ${socket.id}`);
//     });
//   });
// };

// export default initializeSocket;

import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import redisClient from "../config/redis.js"; // Import our new Redis client
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import { saveMessage } from "../services/chat.service.js";
import { notificationQueue } from "../queues/notificationQueue.js";
import { messageQueue } from "../queues/messageQueue.js";
import AppError from "../utils/appError.js";

export let io;

// Key prefix for Redis to store active chat status
const ACTIVE_CHAT_KEY_PREFIX = "activeChat:";

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    connectionStateRecovery: {
      // The backup duration of the sessions and the packets.
      // This means a client can reconnect within 2 minutes and recover its state.
      maxDisconnectionDuration: 2 * 60 * 1000,
      // Whether to skip middlewares upon successful recovery
      skipMiddlewares: true,
    },
  });

  // --- NEW: Set up Redis Adapter ---
  // Create a duplicate of the client for pub/sub
  const pubClient = redisClient.duplicate();
  const subClient = redisClient.duplicate();
  // Replace the default in-memory adapter with the Redis adapter
  io.adapter(createAdapter(pubClient, subClient));
  console.log("Socket.io is now using the Redis adapter.");

  // --- Middleware for authentication (no changes here) ---
  io.use((socket, next) => {
    let token;
    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    } else if (
      socket.handshake.headers &&
      socket.handshake.headers.authorization
    ) {
      token = socket.handshake.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(new AppError("Authentication error: Token not provided.", 401));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return next(new AppError("Authentication error: Invalid token.", 401));
      }
      socket.user = user;
      next();
    });
  });

  // --- Connection handler (no changes here) ---
  io.on("connection", (socket) => {

    const userId = socket.user.id;
    console.log(`🔌 User connected: ${socket.id} | User ID: ${userId}`);

    // Have each user join a private room named after their own user ID
    // User joins their own private room for direct notifications
    socket.join(userId);

    // --- Event Handlers ---

    // Event for a user to join a specific chat room
    socket.on("joinChat", async (message) => {

      let chatId;
      try {
        ({ chatId } = JSON.parse(message));
        if (!chatId) throw new Error("chatId is required.");

        const cacheKey = `user:${userId}:chat:${chatId}:member`;
        const activeChatKey = `${ACTIVE_CHAT_KEY_PREFIX}${userId}`;

        // Check cache for membership
        const cachedResult = await redisClient.get(cacheKey);
        let isMember = cachedResult === 'true';

        if (cachedResult === null) {
          // Cache miss: Check database
          const dbMember = await prisma.chat.findFirst({
            where: { id: chatId, users: { some: { id: userId } } },
            select: { id: true }, // Select minimal data
          });
          isMember = !!dbMember;
          // Update cache (expire after 5 mins)
          await redisClient.setex(cacheKey, 300, isMember ? 'true' : 'false');
          console.log(`User ${userId} membership for chat ${chatId} checked via DB.`);
        } else {
          console.log(`User ${userId} membership for chat ${chatId} checked via cache.`);
        }


        if (isMember) {
          socket.join(chatId);
          // Store active chat in Redis (expire after ~1 hour, refresh on activity)
          await redisClient.setex(activeChatKey, 3600, chatId);
          console.log(`User ${userId} joined chat room ${chatId}. Marked active.`);
        } else {
          socket.emit("error", { message: `You are not authorized to join chat ${chatId}` });
        }
      } catch (error) {
        console.error(`Error in joinChat handler for user ${userId}, chat ${chatId}:`, error);
        socket.emit("error", { message: 'Server error while joining chat.' });
      }










      // const { chatId } = JSON.parse(message);
      // const cacheKey = `user:${userId}:chat:${chatId}:member`; // Unique key for this check
      // const activeChatKey = `${ACTIVE_CHAT_KEY_PREFIX}${userId}`;

      // try {
      //   // 1. Check the cache first
      //   const cachedResult = await redisClient.get(cacheKey);

      //   if (cachedResult) {
      //     // --- Cache Hit ---
      //     if (cachedResult === 'true') {
      //       socket.join(chatId);
      //       console.log(`User ${userId} joined chat room ${chatId} (from cache).`);
      //     } else {
      //       socket.emit('error', { message: `Not authorized for chat ${chatId} (from cache).` });
      //     }
      //     return; // Stop execution
      //   }

      //   // --- Cache Miss ---
      //   // 2. If not in cache, query the database
      //   const isMember = await prisma.chat.findFirst({
      //     where: {
      //       id: chatId,
      //       users: { some: { id: userId } }
      //     }
      //   });

      //   // 3. Update the cache with the result
      //   // Set expiration to 5 minutes (300 seconds)
      //   await redisClient.setex(cacheKey, 300, isMember ? 'true' : 'false');

      //   if (isMember) {
      //     socket.join(chatId);

      //     // Store active chat in Redis (expire after ~1 hour, refresh on activity)
      //     await redisClient.setex(activeChatKey, 3600, chatId);
      //     console.log(`User ${userId} joined chat room ${chatId}. Marked active.`);
      //   } else {
      //     console.log(`Unauthorized DB attempt by user ${userId} to join chat ${chatId}`);
      //     socket.emit('error', { message: `You are not authorized to join chat ${chatId}` });
      //   }
      // } catch (error) {
      //   console.error(`Error in joinChat handler for user ${userId}, chat ${chatId}:`, error);
      //   socket.emit('error', { message: 'Server error while joining chat.' });
      // }
    });

    // --- NEW: Event for when user leaves a chat screen ---
    socket.on("leaveChat", async (message) => {
      try {
        const { chatId } = JSON.parse(message);
        if (!chatId) return;

        const activeChatKey = `${ACTIVE_CHAT_KEY_PREFIX}${userId}`;
        const currentActiveChat = await redisClient.get(activeChatKey);

        // Only remove if they are leaving the chat they were marked active in
        if (currentActiveChat === chatId) {
            await redisClient.del(activeChatKey);
            console.log(`User ${userId} left chat room ${chatId}. Marked inactive.`);
        }
        // No need for socket.leave(chatId) unless explicitly managing room membership counts
      } catch (error) {
         console.error(`Error in leaveChat handler for user ${userId}:`, error);
      }
    });

    // Event for sending a message
    socket.on("sendMessage", async (message) => {
      let chatId, content;
      try {
        ({ chatId, content } = JSON.parse(message));
        if (!chatId || !content) throw new Error("chatId and content required.");

        const senderId = socket.user.id;
        const optimisticMessage = {
          id: `temp-${Date.now()}-${senderId.substring(0, 4)}`, // More unique temp ID
          content,
          createdAt: new Date().toISOString(),
          chatId,
          sender: { id: senderId, name: socket.user.name || "User" }, // Use name from token if available
        };

        // Emit message instantly
        io.to(chatId).emit("receiveMessage", optimisticMessage);

        // Enqueue background jobs
        await Promise.all([
            messageQueue.add("save-message", { chatId, senderId, content }),
            notificationQueue.add("send-chat-notification", { chatId, senderId, messageContent: content }),
            // Refresh active status TTL
            redisClient.expire(`${ACTIVE_CHAT_KEY_PREFIX}${userId}`, 3600)
        ]);

      } catch (error) {
        console.error(`Error in sendMessage handler for user ${userId}, chat ${chatId}:`, error);
        socket.emit("error", { message: "Failed to send message." });
      }
    });

    // Typing Indicators
    socket.on("typing", (message) => {
      try {
        const { chatId } = JSON.parse(message);
        if (!chatId) return;
        socket.volatile.to(chatId).emit("typing", { userId });
      } catch(e) { console.error('Error parsing typing:', e); }
    });

    socket.on("stop_typing", (message) => {
      try {
        const { chatId } = JSON.parse(message);
        if (!chatId) return;
        socket.volatile.to(chatId).emit("stop_typing", { userId });
      } catch(e) { console.error('Error parsing stop_typing:', e); }
    });

    socket.on("disconnect", async () => {
      try {
        // Remove active chat status from Redis on disconnect
        await redisClient.del(`${ACTIVE_CHAT_KEY_PREFIX}${userId}`);
        console.log(`User disconnected: ${socket.id}. Cleared active chat status.`);
      } catch(error) {
         console.error(`Error clearing active status for ${userId} on disconnect:`, error);
      }
    });
  });
};

export default initializeSocket;
