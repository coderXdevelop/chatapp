import type { Request, Response, NextFunction } from 'express';
import { redisClient } from '../services/redis.service.js';

interface MemoryStoreEntry {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, MemoryStoreEntry>();

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix: string;
}) {
  const { windowMs, max, message = 'Too many requests, please try again later.', keyPrefix } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const identifier = req.body?.email ? `${ip}:${req.body.email.trim().toLowerCase()}` : ip;
    const redisKey = `ratelimit:${keyPrefix}:${identifier}`;

    if (redisClient) {
      try {
        const requests = await redisClient.incr(redisKey);
        if (requests === 1) {
          await redisClient.pexpire(redisKey, windowMs);
        }

        if (requests > max) {
          const ttl = await redisClient.pttl(redisKey);
          res.setHeader('Retry-After', Math.ceil(ttl / 1000));
          return res.status(429).json({ message });
        }

        return next();
      } catch (err) {
        console.warn('[RateLimiter] Redis error, falling back to memory store:', err);
      }
    }

    // In-memory fallback
    const now = Date.now();
    const entry = memoryStore.get(redisKey);

    if (!entry || now > entry.resetTime) {
      memoryStore.set(redisKey, { count: 1, resetTime: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({ message });
    }

    return next();
  };
}

// 3 OTP requests allowed per 15 minutes
export const otpRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many verification code requests. Please try again after 15 minutes.',
  keyPrefix: 'otp',
});

// 10 Auth attempts allowed per 15 minutes
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
  keyPrefix: 'auth',
});
