import 'reflect-metadata';
import http from 'http';
import { connectDatabase } from '../config/database';
import { AppDataSource } from '../config/data-source';
import { env } from '../config/env';
import { disconnectCache } from '../utils/cache';
import { logger } from '../utils/logger';
import app from './app';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  logger.info('Database connected and migrations ran');

  const server = http.createServer(app);

  server.listen(env.port, () => {
    logger.info(`Server running on http://localhost:${env.port}`);
    logger.info(`Swagger docs at http://localhost:${env.port}/docs`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal} — shutting down gracefully`);

    server.close(async () => {
      try {
        await AppDataSource.destroy();
        logger.info('Database connection closed');
        await disconnectCache();
        logger.info('Redis connection closed');
      } catch (err) {
        logger.error('Error during shutdown', { error: err });
      } finally {
        process.exit(0);
      }
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
