import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { AppDataSource } from '../config/data-source';
import { swaggerSpec } from '../config/swagger';
import { env } from '../config/env';
import { errorHandler } from '../middlewares/error.middleware';
import { apiRateLimiter } from '../middlewares/rateLimit.middleware';
import routes from '../routes';
import { logger } from '../utils/logger';

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(
  cors({
    origin: env.cors.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// HTTP request logging
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting on all API routes
app.use('/api', apiRateLimiter);

// Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (_req: Request, res: Response) => res.json(swaggerSpec));

// Health check — verifies DB connectivity
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await AppDataSource.query('SELECT 1');
    res.json({ success: true, message: 'OK', db: 'connected' });
  } catch {
    res.status(503).json({ success: false, message: 'Database unavailable', db: 'disconnected' });
  }
});

// API v1 routes
app.use('/api/v1', routes);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
