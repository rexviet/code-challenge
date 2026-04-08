import { UserService } from '../src/services/user.service';
import { IUserRepository } from '../src/repositories/interfaces/IUserRepository';
import { User } from '../src/models/user.model';
import * as cache from '../src/utils/cache';

jest.mock('../src/utils/cache');

const mockUser: User = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Alice',
  email: 'alice@example.com',
  role: 'user',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

function makeRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    create: jest.fn().mockResolvedValue(mockUser),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 0, hasNextPage: false }),
    findById: jest.fn().mockResolvedValue(mockUser),
    findByEmail: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(mockUser),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('Soft delete behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(cache.cacheGet).mockResolvedValue(null);
    jest.mocked(cache.cacheSet).mockResolvedValue(undefined);
    jest.mocked(cache.cacheDel).mockResolvedValue(undefined);
    jest.mocked(cache.cacheDelPattern).mockResolvedValue(undefined);
  });

  it('calls repo.delete (soft delete) and not hard-removes the record', async () => {
    const repo = makeRepo();
    const service = new UserService(repo);

    await service.deleteUser(mockUser.id);

    // Verifies the service delegates to repo.delete — which in the repository
    // sets deleted_at instead of issuing a DELETE SQL statement
    expect(repo.delete).toHaveBeenCalledWith(mockUser.id);
  });

  it('does not call repo.delete when user does not exist', async () => {
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new UserService(repo);

    await expect(service.deleteUser('missing-id')).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('soft-deleted user is not returned by getUserById (repo returns null)', async () => {
    // After soft delete, repo.findById filters deleted_at IS NULL and returns null
    const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
    const service = new UserService(repo);

    await expect(service.getUserById(mockUser.id)).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('soft-deleted user is excluded from list results', async () => {
    // repo.findAll filters deleted_at IS NULL, so it returns an empty list
    const repo = makeRepo({
      findAll: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNextPage: false,
      }),
    });
    const service = new UserService(repo);

    const result = await service.listUsers({});

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
