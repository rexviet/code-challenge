import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../models/user.model';
import { sendError } from '../utils/response.util';

/**
 * Authorization middleware factory.
 *
 * Returns middleware that allows only users with one of the specified roles.
 * Designed to be easily extended for real RBAC/permission-based checks.
 *
 * Usage: requireRole('admin') or requireRole('admin', 'user')
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        `Forbidden: requires one of [${allowedRoles.join(', ')}] role`,
        403,
      );
      return;
    }

    next();
  };
}
