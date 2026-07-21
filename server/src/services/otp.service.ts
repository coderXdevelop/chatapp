import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
let redisClient: Redis | null = null;
const memoryStore = new Map<string, { code: string; expiresAt: number }>();

if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redisClient.on('error', (err: any) => {
      console.warn('Redis client error, falling back to in-memory OTP store:', err.message);
    });
    redisClient.connect().catch((err: any) => {
      console.warn('Redis connection failed, using in-memory OTP store fallback:', err.message);
    });
  } catch (e: any) {
    console.warn('Failed to initialize Redis client, using in-memory OTP store:', e.message);
  }
}

export function generateOTP(): string {
  // Generate 6-digit numeric string
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeOTP(email: string, code: string, ttlSeconds = 300): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `otp:${normalizedEmail}`;

  if (redisClient && redisClient.status === 'ready') {
    try {
      await redisClient.set(key, code, 'EX', ttlSeconds);
      return;
    } catch (e: any) {
      console.warn('Failed to set OTP in Redis, using in-memory store:', e.message);
    }
  }

  // In-memory fallback
  const expiresAt = Date.now() + ttlSeconds * 1000;
  memoryStore.set(normalizedEmail, { code, expiresAt });
}

export async function verifyOTP(email: string, code: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `otp:${normalizedEmail}`;

  if (redisClient && redisClient.status === 'ready') {
    try {
      const storedCode = await redisClient.get(key);
      if (storedCode && storedCode === code.trim()) {
        await redisClient.del(key);
        return true;
      }
      return false;
    } catch (e: any) {
      console.warn('Failed to verify OTP from Redis, checking in-memory store:', e.message);
    }
  }

  // In-memory fallback
  const record = memoryStore.get(normalizedEmail);
  if (!record) return false;

  if (Date.now() > record.expiresAt) {
    memoryStore.delete(normalizedEmail);
    return false;
  }

  if (record.code === code.trim()) {
    memoryStore.delete(normalizedEmail);
    return true;
  }

  return false;
}
