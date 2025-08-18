import jwt from 'jsonwebtoken';
import { saveMessage } from '../services/chat.service.js';
import prisma from '../config/db.js';

const initializeSocket = (io) => {
  // Middleware for authenticating socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: Token not provided.'));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return next(new Error('Authentication error: Invalid token.'));
      }
      socket.user = user; // Attach user info to the socket object
      next();
    });
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id} | Name: ${socket.user.id}`);

    // Event for a user to join a specific chat room
    socket.on('joinChat', async (chatId) => {
      // Security check: Ensure the user is a member of this chat
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
      }
    });

    // Event for sending a message
    socket.on('sendMessage', async ({ chatId, content }) => {
      try {
        const senderId = socket.user.id;

        // Save the message to the database
        const newMessage = await saveMessage(chatId, senderId, content);

        // Broadcast the new message to everyone in the specific chat room
        io.to(chatId).emit('receiveMessage', newMessage);
      } catch (error) {
        console.error(error);
        // Optionally, emit an error event back to the sender
        socket.emit('error', { message: 'Failed to send message.' });
      }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
      console.log(`🔥 User disconnected: ${socket.id}`);
    });
  });
};

export default initializeSocket;