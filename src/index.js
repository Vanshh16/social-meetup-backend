import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';
import initializeSocket from './socket/socketHandler.js'
import './queues/messageQueue.js'; 

import authRoutes from './routes/auth.routes.js';
import meetupRoutes from './routes/meetup.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import joinRequestRoutes from './routes/joinRequest.routes.js';
import matchRoutes from './routes/match.routes.js';
import adminRoutes from './routes/admin.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import reportRoutes from './routes/report.routes.js';
import userRoutes from './routes/user.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import bannerRoutes from './routes/banner.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

initializeSocket(httpServer);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/meetups', meetupRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/join', joinRequestRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/banners', bannerRoutes);
app.use('/api/v1/chats', chatRoutes);

app.use(errorHandler);

app.get('/', (req, res) => res.send('API Running'));

const PORT = process.env.PORT || 5000;

// Use httpServer to listen, not app
httpServer.listen(PORT, () => {
  console.log(`Server with Socket.io running on port ${PORT}`);
    // console.log(`Server running on port ${PORT}`);

});
