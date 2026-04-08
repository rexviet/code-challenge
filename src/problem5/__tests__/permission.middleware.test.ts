import { Request, Response, NextFunction } from 'express';
import { requireRole } from '../src/middlewares/permission.middleware';
import { MockUser } from '../src/middlewares/auth.middleware';

function makeReq(user?: MockUser): Request {
  return { user } as unknown as Request;
}

function makeRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const next: NextFunction = jest.fn();

describe('requireRole middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls next when user has the required role', () => {
    const middleware = requireRole('admin');
    middleware(makeReq({ id: 'u1', role: 'admin' }), makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next when user has one of multiple allowed roles', () => {
    const middleware = requireRole('admin', 'user');
    middleware(makeReq({ id: 'u1', role: 'user' }), makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('returns 403 when user role is not in allowed list', () => {
    const middleware = requireRole('admin');
    const res = makeRes();
    middleware(makeReq({ id: 'u1', role: 'user' }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no user is attached to request', () => {
    const middleware = requireRole('admin');
    const res = makeRes();
    middleware(makeReq(undefined), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
