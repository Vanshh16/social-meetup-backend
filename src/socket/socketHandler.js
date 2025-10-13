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
import { messageQueue } from "../queues/messageQueue.js";

export let io;

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
  const subClient = redisClient.duplicate();

  // Replace the default in-memory adapter with the Redis adapter
  io.adapter(createAdapter(redisClient, subClient));
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
      return next(new Error("Authentication error: Token not provided."));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return next(new Error("Authentication error: Invalid token."));
      }
      socket.user = user;
      next();
    });
  });

  // --- Connection handler (no changes here) ---
  io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.id} | User ID: ${socket.user.id}`);

    // Have each user join a private room named after their own user ID
    socket.join(socket.user.id);

    // Event for a user to join a specific chat room
    socket.on("joinChat", async (message) => {
      const { chatId } = JSON.parse(message);
      console.log("chatIdXXXXX: ", message);

      const userId = socket.user.id;
      const cacheKey = `user:${userId}:chat:${chatId}:member`; // Unique key for this check

      // const isMember = await prisma.chat.findFirst({
      //   where: {
      //     id: chatId,
      //     users: { some: { id: socket.user.id } },
      //   },
      // });

      // if (isMember) {
      //   socket.join(chatId);
      //   console.log(`User ${socket.user.id} joined chat room: ${chatId}`);
      // } else {
      //   console.log(
      //     `Unauthorized attempt by user ${socket.user.id} to join chat ${chatId}`
      //   );
      //   // --- ENHANCEMENT 3: Emit Error to Client ---
      //   socket.emit("error", {
      //     message: `You are not authorized to join chat ${chatId}`,
      //   });
      // }

      try {
        // 1. Check the cache first
        const cachedResult = await redisClient.get(cacheKey);

        if (cachedResult) {
          // --- Cache Hit ---
          if (cachedResult === 'true') {
            socket.join(chatId);
            console.log(`User ${userId} joined chat room ${chatId} (from cache).`);
          } else {
            socket.emit('error', { message: `Not authorized for chat ${chatId} (from cache).` });
          }
          return; // Stop execution
        }

        // --- Cache Miss ---
        // 2. If not in cache, query the database
        const isMember = await prisma.chat.findFirst({
          where: {
            id: chatId,
            users: { some: { id: userId } }
          }
        });

        // 3. Update the cache with the result
        // Set expiration to 5 minutes (300 seconds)
        await redisClient.setex(cacheKey, 300, isMember ? 'true' : 'false');

        if (isMember) {
          socket.join(chatId);
          console.log(`User ${userId} joined chat room ${chatId} (from DB).`);
        } else {
          console.log(`Unauthorized DB attempt by user ${userId} to join chat ${chatId}`);
          socket.emit('error', { message: `You are not authorized to join chat ${chatId}` });
        }
      } catch (error) {
        console.error(`Error in joinChat handler for chat ${chatId}:`, error);
        socket.emit('error', { message: 'Server error while joining chat.' });
      }
    });

    // Event for sending a message
    socket.on("sendMessage", async (message) => {
      const { chatId, content } = JSON.parse(message);
      console.log("chatId, content", chatId, content);
      try {
        const senderId = socket.user.id;
        // const newMessage = await saveMessage(chatId, senderId, content);

        // 1. Optimistically create the message object for immediate broadcast.
        // This makes the UI feel instant.
        const optimisticMessage = {
          id: `temp-${Date.now()}`, // A temporary ID for the frontend
          content,
          createdAt: new Date().toISOString(),
          chatId,
          sender: {
            id: senderId,
            name: socket.user.name, // Assuming name is in JWT payload
          },
        };

        // 2. Broadcast the message immediately to all clients in the room.
        io.to(chatId).emit("receiveMessage", optimisticMessage);

        // // Broadcast the new message to everyone in the specific chat room
        // io.to(chatId).emit('receiveMessage', newMessage);

        // 3. Add the actual database save operation to the background queue.
        await messageQueue.add("save-message", {
          chatId,
          senderId,
          content,
        });
      } catch (error) {
        console.error(error);
        socket.emit("error", { message: "Failed to send message." });
      }
    });

    // Typing Indicators
    socket.on("typing", ({ chatId }) => {
      // Broadcast to everyone in the chat room EXCEPT the sender
      socket.volatile.to(chatId).emit("typing", { userId: socket.user.id });
    });

    socket.on("stop_typing", ({ chatId }) => {
      socket.volatile
        .to(chatId)
        .emit("stop_typing", { userId: socket.user.id });
    });
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

export default initializeSocket;
