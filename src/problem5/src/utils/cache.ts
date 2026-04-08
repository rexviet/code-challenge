import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

// Skip Redis entirely in test environment to avoid open handles
const IS_TEST = env.nodeEnv === 'test';

let client: Redis | null = null;

function getClient(): Redis {
  if (!client) {
    client = new Redis({
      host: env.redis.host,
      port: env.redis.port,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 1000)),
      maxRetriesPerRequest: 0,
    });

    client.on('connect', () => logger.info('Redis connected'));
    client.on('error', (err) => logger.warn('Redis error — cache disabled', { error: err.message }));
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (IS_TEST) return null;
  try {
    const value = await getClient().get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl = env.redis.ttl): Promise<void> {
  if (IS_TEST) return;
  try {
    await getClient().set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // Cache failure is non-fatal — continue without caching
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (IS_TEST) return;
  try {
    if (keys.length > 0) await getClient().del(...keys);
  } catch {
    // Non-fatal
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (IS_TEST) return;
  try {
    const keys = await getClient().keys(pattern);
    if (keys.length > 0) await getClient().del(...keys);
  } catch {
    // Non-fatal
  }
}

export async function disconnectCache(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
