import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import settingsRoutes from './routes/settingsRoutes.js';
import callRoutes from './routes/callRoutes.js';
import storyRoutes from './routes/storyRoutes.js';
import setupSocketHandlers from './utils/socketHandler.js';


// Route imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import verificationRoutes from './routes/verificationRoutes.js';


// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Initialize express app
const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

setupSocketHandlers(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/verification', verificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Socket.IO connection handling
const userSockets = new Map(); // userId -> socketId mapping

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // User comes online
  socket.on('user-online', async (userId) => {
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    
    // Broadcast to all users that this user is online
    io.emit('user-status', { userId, isActive: true });
    
    console.log(`✅ User ${userId} is online`);
  });

  // Send message
  socket.on('send-message', async (data) => {
    const { senderId, receiverId, text } = data;
    
    try {
      // Emit to receiver if online
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive-message', {
          senderId,
          receiverId,
          text,
          timestamp: new Date()
        });
      }
      
      // Confirm to sender
      socket.emit('message-sent', { success: true });
    } catch (error) {
      console.error('Message error:', error);
      socket.emit('message-error', { error: error.message });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { receiverId } = data;
    const receiverSocketId = userSockets.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user-typing', {
        userId: socket.userId
      });
    }
  });

  // Stop typing
  socket.on('stop-typing', (data) => {
    const { receiverId } = data;
    const receiverSocketId = userSockets.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user-stop-typing', {
        userId: socket.userId
      });
    }
  });

  // Audio call events
  socket.on('call-user', (data) => {
    const { to, offer, from } = data;
    const receiverSocketId = userSockets.get(to);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('incoming-call', {
        from,
        offer
      });
    }
  });

  socket.on('answer-call', (data) => {
    const { to, answer } = data;
    const callerSocketId = userSockets.get(to);
    
    if (callerSocketId) {
      io.to(callerSocketId).emit('call-answered', {
        answer
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const { to, candidate } = data;
    const targetSocketId = userSockets.get(to);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice-candidate', {
        candidate
      });
    }
  });

  socket.on('end-call', (data) => {
    const { to } = data;
    const targetSocketId = userSockets.get(to);
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('call-ended');
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
      io.emit('user-status', { 
        userId: socket.userId, 
        isActive: false 
      });
      console.log(`❌ User ${socket.userId} disconnected`);
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.log(`❌ Error: ${err.message}`);
  httpServer.close(() => process.exit(1));
});


// backend/src/server.js or app.js

import cors from 'cors';

// CORS Configuration for Production
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  'http://localhost:5173', // for local development
].filter(Boolean); // Remove any undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));