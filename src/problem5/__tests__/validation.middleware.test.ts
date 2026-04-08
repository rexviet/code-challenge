import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../src/middlewares/validation.middleware';

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

const testSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
});

describe('validate middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls next when body is valid', async () => {
    const req = makeReq({ body: { name: 'Alice', email: 'alice@example.com' } });
    await validate(testSchema)(req, makeRes(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('returns 400 with structured errors when body is invalid', async () => {
    const req = makeReq({ body: { name: '', email: 'not-an-email' } });
    const res = makeRes();

    await validate(testSchema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'name' }),
          expect.objectContaining({ field: 'email' }),
        ]),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('merges coerced values back into req.body', async () => {
    const coercingSchema = z.object({
      body: z.object({
        count: z.coerce.number(),
      }),
    });
    const req = makeReq({ body: { count: '5' } });
    await validate(coercingSchema)(req, makeRes(), next);

    expect(req.body.count).toBe(5);
    expect(next).toHaveBeenCalledWith();
  });
});
