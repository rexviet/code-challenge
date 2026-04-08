import { Request, Response, NextFunction } from 'express';
import { validate } from '../src/middlewares/validation.middleware';
import {
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
} from '../src/validators/user.validator';

function makeReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, params: {}, query: {}, ...overrides } as unknown as Request;
}

function makeRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const next: NextFunction = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('createUserSchema — string trimming', () => {
  it('trims leading/trailing whitespace from name and email', async () => {
    const req = makeReq({ body: { name: '  Alice  ', email: '  alice@example.com  ' } });
    await validate(createUserSchema)(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.name).toBe('Alice');
    expect(req.body.email).toBe('alice@example.com');
  });

  it('rejects name that is only whitespace after trim', async () => {
    const req = makeReq({ body: { name: '   ', email: 'alice@example.com' } });
    const res = makeRes();
    await validate(createUserSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('updateUserSchema — string trimming', () => {
  const validParams = { id: '00000000-0000-0000-0000-000000000001' };

  it('trims name and email in update body', async () => {
    const req = makeReq({
      body: { name: '  Bob  ', email: '  bob@example.com  ' },
      params: validParams,
    });
    await validate(updateUserSchema)(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.name).toBe('Bob');
    expect(req.body.email).toBe('bob@example.com');
  });
});

describe('listUsersSchema — sorting', () => {
  it('accepts valid sortBy values', async () => {
    const validFields = ['name', 'email', 'created_at', 'updated_at'];

    for (const sortBy of validFields) {
      const req = makeReq({ query: { sortBy } });
      await validate(listUsersSchema)(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.query.sortBy).toBe(sortBy);
      jest.clearAllMocks();
    }
  });

  it('rejects invalid sortBy value', async () => {
    const req = makeReq({ query: { sortBy: 'password' } });
    const res = makeRes();
    await validate(listUsersSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid sortOrder values', async () => {
    for (const sortOrder of ['ASC', 'DESC']) {
      const req = makeReq({ query: { sortOrder } });
      await validate(listUsersSchema)(req, makeRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.query.sortOrder).toBe(sortOrder);
      jest.clearAllMocks();
    }
  });

  it('rejects invalid sortOrder value', async () => {
    const req = makeReq({ query: { sortOrder: 'asc' } }); // lowercase not valid
    const res = makeRes();
    await validate(listUsersSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('defaults sortBy to created_at and sortOrder to DESC', async () => {
    const req = makeReq({ query: {} });
    await validate(listUsersSchema)(req, makeRes(), next);

    expect(req.query.sortBy).toBe('created_at');
    expect(req.query.sortOrder).toBe('DESC');
  });

  it('trims name and email query filters', async () => {
    const req = makeReq({ query: { name: '  Alice  ', email: '  alice@  ' } });
    await validate(listUsersSchema)(req, makeRes(), next);

    expect(req.query.name).toBe('Alice');
  });
});

describe('listUsersSchema — pagination metadata inputs', () => {
  it('coerces page and limit to numbers with defaults', async () => {
    const req = makeReq({ query: {} });
    await validate(listUsersSchema)(req, makeRes(), next);

    expect(req.query.page).toBe(1);
    expect(req.query.limit).toBe(10);
  });

  it('rejects limit above 100', async () => {
    const req = makeReq({ query: { limit: '200' } });
    const res = makeRes();
    await validate(listUsersSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
