import { Redis } from 'ioredis';

let redisUrl = process.env.REDIS_URL;
const redisToken = process.env.REDIS_TOKEN;

if (redisUrl && (redisUrl.startsWith('http://') || redisUrl.startsWith('https://'))) {
  try {
    const host = new URL(redisUrl).hostname;
    if (host && redisToken) {
      redisUrl = `rediss://default:${redisToken}@${host}:6379`;
    }
  } catch {}
}

let redisClient: Redis | null = null;

if (redisUrl && (redisUrl.startsWith('redis://') || redisUrl.startsWith('rediss://'))) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });
    redisClient.on('error', (err: any) => {
      console.warn('Redis client error:', err.message);
    });
    redisClient.connect().catch((err: any) => {
      console.warn('Redis connection failed:', err.message);
    });
  } catch (e: any) {
    console.warn('Failed to initialize Redis client:', e.message);
  }
}

export { redisClient };
