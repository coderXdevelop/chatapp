import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

app.get('/health', (_, res) => res.send({ status: 'ok', timestamp: new Date() }));

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || '';

if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB successfully.'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.warn('MONGO_URI is not set in environment variables.');
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`ChatConnect Server running on port ${PORT}`));
