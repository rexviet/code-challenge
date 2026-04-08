import dotenv from 'dotenv';
dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  baseUrl: process.env.APP_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`,

  db: {
    host: requireEnv('DB_HOST'),
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: requireEnv('DB_USER'),
    password: requireEnv('DB_PASSWORD'),
    name: requireEnv('DB_NAME'),
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    ttl: parseInt(process.env.REDIS_TTL ?? '300', 10),
  },

  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
  },

  mockAuth: {
    enabled: process.env.MOCK_AUTH_ENABLED !== 'false',
  },
};
