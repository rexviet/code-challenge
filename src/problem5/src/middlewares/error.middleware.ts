import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  logger.error('Unhandled error', { message: err.message, stack: err.stack });

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.nodeEnv !== 'production' && { detail: err.message }),
  });
}
