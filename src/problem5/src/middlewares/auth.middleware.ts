import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { UserRole } from '../models/user.model';
import { sendError } from '../utils/response.util';

export interface MockUser {
  id: string;
  role: UserRole;
}

/**
 * Mock authentication middleware.
 *
 * When MOCK_AUTH_ENABLED=false, skips auth and attaches a default admin identity.
 * When enabled, reads the Authorization header and extracts a mock user identity.
 * Expected token format: `mock-{role}-{userId}` (e.g. `mock-admin-user1`).
 *
 * Structure is designed so this middleware can be replaced with real
 * JWT verification (e.g. jsonwebtoken.verify) without touching routes or controllers.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!env.mockAuth.enabled) {
    req.user = { id: 'dev-user', role: 'admin' };
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Missing or invalid Authorization header', 401);
    return;
  }

  const token = authHeader.slice(7);
  const parts = token.split('-');

  // Expected: mock-{role}-{userId}
  if (parts.length < 3 || parts[0] !== 'mock') {
    sendError(res, 'Invalid mock token format. Expected: mock-{role}-{userId}', 401);
    return;
  }

  const role = parts[1] as UserRole;
  if (role !== 'user' && role !== 'admin') {
    sendError(res, 'Invalid role in mock token', 401);
    return;
  }

  const userId = parts.slice(2).join('-');
  req.user = { id: userId, role };
  next();
}
