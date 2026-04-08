import { Request, Response, NextFunction } from 'express';
import { UserController } from '../src/controllers/user.controller';
import { IUserService } from '../src/services/interfaces/IUserService';
import { AppError } from '../src/utils/errors';
import { User } from '../src/models/user.model';

const mockUser: User = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'user',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

function makeService(overrides: Partial<IUserService> = {}): IUserService {
  return {
    createUser: jest.fn().mockResolvedValue(mockUser),
    listUsers: jest.fn().mockResolvedValue({ items: [mockUser], total: 1, page: 1, limit: 10 }),
    getUserById: jest.fn().mockResolvedValue(mockUser),
    updateUser: jest.fn().mockResolvedValue(mockUser),
    deleteUser: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return { body: {}, params: {}, query: {}, ...overrides } as unknown as Request;
}

const next: NextFunction = jest.fn();

describe('UserController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('returns 201 with created user', async () => {
      const service = makeService();
      const controller = new UserController(service);
      const req = makeReq({ body: { name: 'Alice', email: 'alice@example.com' } });
      const res = makeRes();

      await controller.create(req, res, next);

      expect(service.createUser).toHaveBeenCalledWith({ name: 'Alice', email: 'alice@example.com' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockUser }),
      );
    });

    it('calls next with error on service failure', async () => {
      const err = new AppError('Email already in use', 409);
      const service = makeService({ createUser: jest.fn().mockRejectedValue(err) });
      const controller = new UserController(service);

      await controller.create(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('list', () => {
    it('returns 200 with paginated data', async () => {
      const service = makeService();
      const controller = new UserController(service);
      const req = makeReq({ query: { page: '1', limit: '10' } as never });
      const res = makeRes();

      await controller.list(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ items: [mockUser], total: 1 }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('returns 200 with user', async () => {
      const service = makeService();
      const controller = new UserController(service);
      const req = makeReq({ params: { id: mockUser.id } });
      const res = makeRes();

      await controller.getById(req, res, next);

      expect(service.getUserById).toHaveBeenCalledWith(mockUser.id);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('calls next with 404 error when not found', async () => {
      const err = new AppError('User not found', 404);
      const service = makeService({ getUserById: jest.fn().mockRejectedValue(err) });
      const controller = new UserController(service);

      await controller.getById(makeReq({ params: { id: 'bad' } }), makeRes(), next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('update', () => {
    it('returns 200 with updated user', async () => {
      const service = makeService();
      const controller = new UserController(service);
      const req = makeReq({ params: { id: mockUser.id }, body: { name: 'Updated' } });
      const res = makeRes();

      await controller.update(req, res, next);

      expect(service.updateUser).toHaveBeenCalledWith(mockUser.id, { name: 'Updated' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('delete', () => {
    it('returns 200 on successful delete', async () => {
      const service = makeService();
      const controller = new UserController(service);
      const req = makeReq({ params: { id: mockUser.id } });
      const res = makeRes();

      await controller.delete(req, res, next);

      expect(service.deleteUser).toHaveBeenCalledWith(mockUser.id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });
});
