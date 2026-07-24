import { redisClient } from './redis.service.js';

const memoryStore = new Map<string, { code: string; expiresAt: number }>();


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
