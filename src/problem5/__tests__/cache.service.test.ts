import { UserService } from '../src/services/user.service';
import { IUserRepository } from '../src/repositories/interfaces/IUserRepository';
import { User } from '../src/models/user.model';
import { AppError } from '../src/utils/errors';
import * as cache from '../src/utils/cache';

jest.mock('../src/utils/cache');

const mockedCache = jest.mocked(cache);

const mockUser: User = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'user',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const paginatedResult = {
  items: [mockUser],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
  hasNextPage: false,
};

function makeRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    create: jest.fn().mockResolvedValue(mockUser),
    findAll: jest.fn().mockResolvedValue(paginatedResult),
    findById: jest.fn().mockResolvedValue(mockUser),
    findByEmail: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(mockUser),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('UserService — cache behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCache.cacheGet.mockResolvedValue(null);
    mockedCache.cacheSet.mockResolvedValue(undefined);
    mockedCache.cacheDel.mockResolvedValue(undefined);
    mockedCache.cacheDelPattern.mockResolvedValue(undefined);
  });

  describe('getUserById', () => {
    it('returns cached user without hitting repository', async () => {
      mockedCache.cacheGet.mockResolvedValue(mockUser);
      const repo = makeRepo();
      const service = new UserService(repo);

      const result = await service.getUserById(mockUser.id);

      expect(result).toEqual(mockUser);
      expect(repo.findById).not.toHaveBeenCalled();
      expect(mockedCache.cacheGet).toHaveBeenCalledWith(`user:v1:${mockUser.id}`);
    });

    it('fetches from repository on cache miss and stores result in cache', async () => {
      mockedCache.cacheGet.mockResolvedValue(null);
      const repo = makeRepo();
      const service = new UserService(repo);

      const result = await service.getUserById(mockUser.id);

      expect(repo.findById).toHaveBeenCalledWith(mockUser.id);
      expect(mockedCache.cacheSet).toHaveBeenCalledWith(`user:v1:${mockUser.id}`, mockUser);
      expect(result).toEqual(mockUser);
    });

    it('throws 404 and does not cache when user not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const service = new UserService(repo);

      await expect(service.getUserById('missing-id')).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(mockedCache.cacheSet).not.toHaveBeenCalled();
    });
  });

  describe('listUsers', () => {
    it('returns cached list without hitting repository', async () => {
      mockedCache.cacheGet.mockResolvedValue(paginatedResult);
      const repo = makeRepo();
      const service = new UserService(repo);

      const result = await service.listUsers({ page: 1, limit: 10 });

      expect(result).toEqual(paginatedResult);
      expect(repo.findAll).not.toHaveBeenCalled();
    });

    it('fetches from repository on cache miss and caches the result', async () => {
      const repo = makeRepo();
      const service = new UserService(repo);

      await service.listUsers({ page: 1, limit: 10 });

      expect(repo.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(mockedCache.cacheSet).toHaveBeenCalled();
    });
  });

  describe('cache invalidation', () => {
    it('invalidates list cache after createUser', async () => {
      const repo = makeRepo();
      const service = new UserService(repo);

      await service.createUser({ name: 'Bob', email: 'bob@example.com' });

      expect(mockedCache.cacheDelPattern).toHaveBeenCalledWith('users:v1:*');
    });

    it('invalidates user and list cache after updateUser', async () => {
      const repo = makeRepo();
      const service = new UserService(repo);

      await service.updateUser(mockUser.id, { name: 'Alice Updated' });

      expect(mockedCache.cacheDel).toHaveBeenCalledWith(`user:v1:${mockUser.id}`);
      expect(mockedCache.cacheDelPattern).toHaveBeenCalledWith('users:v1:*');
    });

    it('invalidates user and list cache after deleteUser', async () => {
      const repo = makeRepo();
      const service = new UserService(repo);

      await service.deleteUser(mockUser.id);

      expect(mockedCache.cacheDel).toHaveBeenCalledWith(`user:v1:${mockUser.id}`);
      expect(mockedCache.cacheDelPattern).toHaveBeenCalledWith('users:v1:*');
    });
  });
});
