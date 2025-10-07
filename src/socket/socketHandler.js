import jwt from 'jsonwebtoken';
import { saveMessage } from '../services/chat.service.js';
import prisma from '../config/db.js';
import { Server } from 'socket.io'; 

export let io;

const initializeSocket = (httpServer) => {
  // --- Initialize io here ---
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.use((socket, next) => {
    let token;

    if (socket.handshake.auth && socket.handshake.auth.token) {
      // Modern client (e.g., socket.io-client)
      token = socket.handshake.auth.token;
    } else if (socket.handshake.headers && socket.handshake.headers.authorization) {
      // Client that uses headers (e.g., Postman)
      token = socket.handshake.headers.authorization.split(' ')[1];
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return next(new Error('Authentication error: Invalid token.'));
      }
      socket.user = user;
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id} | User ID: ${socket.user.id}`);

    // Have each user join a private room named after their own user ID
    socket.join(socket.user.id);

    // Event for a user to join a specific chat room
    socket.on('joinChat', async (message) => {
      const { chatId } = JSON.parse(message);
      console.log("chatIdXXXXX: ", message);
      
      const isMember = await prisma.chat.findFirst({
        where: {
          id: chatId,
          users: { some: { id: socket.user.id } }
        }
      });

      if (isMember) {
        socket.join(chatId);
        console.log(`User ${socket.user.id} joined chat room: ${chatId}`);
      } else {
        console.log(`Unauthorized attempt by user ${socket.user.id} to join chat ${chatId}`);
        // --- ENHANCEMENT 3: Emit Error to Client ---
        socket.emit('error', { message: `You are not authorized to join chat ${chatId}` });
      }
    });

    // Event for sending a message
    socket.on('sendMessage', async (message) => {
      const { chatId, content } = JSON.parse(message);
      console.log("chatId, content", chatId, content);
      try {
        const senderId = socket.user.id;
        const newMessage = await saveMessage(chatId, senderId, content);

        // Broadcast the new message to everyone in the specific chat room
        io.to(chatId).emit('receiveMessage', newMessage);
      } catch (error) {
        console.error(error);
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    // Typing Indicators
socket.on('typing', ({ chatId }) => {
        // Broadcast to everyone in the chat room EXCEPT the sender
        socket.to(chatId).emit('typing', { userId: socket.user.id });
    });

    socket.on('stop_typing', ({ chatId }) => {
        socket.to(chatId).emit('stop_typing', { userId: socket.user.id });
    });
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

export default initializeSocket;