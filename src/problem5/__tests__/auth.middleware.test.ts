import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../src/middlewares/auth.middleware';

function makeReq(authorization?: string): Request {
  return { headers: { authorization } } as unknown as Request;
}

function makeRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const next: NextFunction = jest.fn();

describe('authenticate middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('attaches mock user and calls next for valid admin token', () => {
    const req = makeReq('Bearer mock-admin-user1');
    authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'user1', role: 'admin' });
  });

  it('attaches mock user and calls next for valid user token', () => {
    const req = makeReq('Bearer mock-user-abc123');
    authenticate(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({ id: 'abc123', role: 'user' });
  });

  it('returns 401 when Authorization header is missing', () => {
    const res = makeRes();
    authenticate(makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', () => {
    const res = makeRes();
    authenticate(makeReq('Token mock-admin-user1'), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for token with wrong prefix', () => {
    const res = makeRes();
    authenticate(makeReq('Bearer invalid-admin-user1'), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for token with invalid role', () => {
    const res = makeRes();
    authenticate(makeReq('Bearer mock-superuser-id1'), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
