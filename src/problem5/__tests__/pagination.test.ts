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

function makeRepo(findAllResult: object): IUserRepository {
  return {
    create: jest.fn(),
    findAll: jest.fn().mockResolvedValue(findAllResult),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(cache.cacheGet).mockResolvedValue(null);
  jest.mocked(cache.cacheSet).mockResolvedValue(undefined);
});

describe('Pagination metadata', () => {
  it('returns totalPages and hasNextPage=false when on last page', async () => {
    const repo = makeRepo({
      items: [mockUser],
      total: 5,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNextPage: false,
    });
    const service = new UserService(repo);

    const result = await service.listUsers({ page: 1, limit: 10 });

    expect(result.totalPages).toBe(1);
    expect(result.hasNextPage).toBe(false);
    expect(result.total).toBe(5);
  });

  it('returns hasNextPage=true when more pages exist', async () => {
    const repo = makeRepo({
      items: Array(10).fill(mockUser),
      total: 25,
      page: 1,
      limit: 10,
      totalPages: 3,
      hasNextPage: true,
    });
    const service = new UserService(repo);

    const result = await service.listUsers({ page: 1, limit: 10 });

    expect(result.totalPages).toBe(3);
    expect(result.hasNextPage).toBe(true);
  });

  it('returns hasNextPage=false on the last of multiple pages', async () => {
    const repo = makeRepo({
      items: Array(5).fill(mockUser),
      total: 25,
      page: 3,
      limit: 10,
      totalPages: 3,
      hasNextPage: false,
    });
    const service = new UserService(repo);

    const result = await service.listUsers({ page: 3, limit: 10 });

    expect(result.totalPages).toBe(3);
    expect(result.hasNextPage).toBe(false);
  });

  it('returns totalPages=0 and hasNextPage=false when no items', async () => {
    const repo = makeRepo({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      hasNextPage: false,
    });
    const service = new UserService(repo);

    const result = await service.listUsers({});

    expect(result.totalPages).toBe(0);
    expect(result.hasNextPage).toBe(false);
    expect(result.items).toHaveLength(0);
  });
});
