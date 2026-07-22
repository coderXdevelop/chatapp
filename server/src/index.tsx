import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import User from './models/User.js';
import { setupSockets } from './sockets/socket.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io); // Register socket.io instance for controller usage

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);

app.get('/health', (_, res) => res.send({ status: 'ok', timestamp: new Date() }));

// Setup Sockets
setupSockets(io);

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';

if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(async () => {
      console.log('Connected to MongoDB successfully.');
      try {
        const legacyUsers = await User.find({ connectId: { $exists: false } });
        for (const user of legacyUsers) {
          const parts = (user.email || '').split('@');
          const base = (parts[0] || 'user').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          let uniqueId = base;
          let collision = await User.findOne({ connectId: uniqueId });
          while (collision) {
            uniqueId = `${base}_${Math.floor(1000 + Math.random() * 9000)}`;
            collision = await User.findOne({ connectId: uniqueId });
          }
          user.connectId = uniqueId;
          await user.save();
          console.log(`Migrated User: ${user.email} -> allocated connectId: ${uniqueId}`);
        }
      } catch (err) {
        console.error('Error migrating legacy users:', err);
      }
    })
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.warn('MONGO_URI is not set in environment variables.');
}

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => console.log(`ChatConnect Server running on port ${PORT}`));
