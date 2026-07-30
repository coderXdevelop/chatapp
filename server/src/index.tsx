import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import mediaRoutes from './routes/media.routes.js';
import userRoutes from './routes/user.routes.js';
import adminRoutes from './routes/admin.routes.js';
import statusRoutes from './routes/status.routes.js';
import User from './models/User.js';
import { setupSockets } from './sockets/socket.js';
import { initBackgroundCronServices } from './services/cron.service.js';
import { validateEnv } from './services/env.service.js';

dotenv.config();
validateEnv();

const app = express();
const httpServer = createServer(app);

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:8081', 'http://localhost:19006', 'http://localhost:3000'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Expo client, cURL) or matching whitelist
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by Socket.IO CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io); // Register socket.io instance for controller usage

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/status', statusRoutes);

// Start background Cloudinary maintenance cron jobs
initBackgroundCronServices();


app.get('/health', (_, res) => res.send({ status: 'ok', timestamp: new Date() }));
app.get('/api/keep-alive', (_, res) => res.status(200).json({ status: 'active', timestamp: new Date() }));

// Setup Sockets
setupSockets(io);

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';

if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    })
    .then(() => {
      console.log('Connected to MongoDB successfully.');
    })
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.warn('MONGO_URI is not set in environment variables.');
}

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`ChatConnect Server running on port ${PORT}`));
