import { AppError } from '../src/utils/errors';
import { UserService } from '../src/services/user.service';
import { IUserRepository } from '../src/repositories/interfaces/IUserRepository';
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

function makeRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    create: jest.fn().mockResolvedValue(mockUser),
    findAll: jest.fn().mockResolvedValue({ items: [mockUser], total: 1, page: 1, limit: 10, totalPages: 1, hasNextPage: false }),
    findById: jest.fn().mockResolvedValue(mockUser),
    findByEmail: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(mockUser),
    delete: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('UserService', () => {
  describe('createUser', () => {
    it('creates a user when email is not taken', async () => {
      const repo = makeRepo();
      const service = new UserService(repo);

      const result = await service.createUser({ name: 'Alice', email: 'alice@example.com' });

      expect(repo.findByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(repo.create).toHaveBeenCalledWith({ name: 'Alice', email: 'alice@example.com' });
      expect(result).toEqual(mockUser);
    });

    it('throws 409 when email is already in use', async () => {
      const repo = makeRepo({ findByEmail: jest.fn().mockResolvedValue(mockUser) });
      const service = new UserService(repo);

      await expect(
        service.createUser({ name: 'Bob', email: 'alice@example.com' }),
      ).rejects.toMatchObject({ message: 'Email already in use', statusCode: 409 });

      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('listUsers', () => {
    it('returns paginated users from repository', async () => {
      const repo = makeRepo();
      const service = new UserService(repo);

      const result = await service.listUsers({ page: 1, limit: 10 });

      expect(repo.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getUserById', () => {
    it('returns user when found', async () => {
      const repo = makeRepo();
      const service = new UserService(repo);

      const result = await service.getUserById(mockUser.id);

      expect(repo.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('throws 404 when user not found', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const service = new UserService(repo);

      await expect(service.getUserById('nonexistent-id')).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });
    });
  });

  describe('updateUser', () => {
    it('updates user successfully', async () => {
      const updated = { ...mockUser, name: 'Alice Updated' };
      const repo = makeRepo({ update: jest.fn().mockResolvedValue(updated) });
      const service = new UserService(repo);

      const result = await service.updateUser(mockUser.id, { name: 'Alice Updated' });

      expect(repo.update).toHaveBeenCalledWith(mockUser.id, { name: 'Alice Updated' });
      expect(result.name).toBe('Alice Updated');
    });

    it('throws 404 when updating non-existent user', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const service = new UserService(repo);

      await expect(service.updateUser('bad-id', { name: 'X' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('throws 409 when new email is taken by another user', async () => {
      const otherUser = { ...mockUser, id: 'other-id' };
      const repo = makeRepo({
        findByEmail: jest.fn().mockResolvedValue(otherUser),
      });
      const service = new UserService(repo);

      await expect(
        service.updateUser(mockUser.id, { email: 'taken@example.com' }),
      ).rejects.toMatchObject({ message: 'Email already in use', statusCode: 409 });
    });

    it('allows updating own email', async () => {
      // findByEmail returns the same user → no conflict
      const repo = makeRepo({ findByEmail: jest.fn().mockResolvedValue(mockUser) });
      const service = new UserService(repo);

      const result = await service.updateUser(mockUser.id, { email: mockUser.email });

      expect(result).toEqual(mockUser);
    });
  });

  describe('deleteUser', () => {
    it('deletes user successfully', async () => {
      const repo = makeRepo();
      const service = new UserService(repo);

      await expect(service.deleteUser(mockUser.id)).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith(mockUser.id);
    });

    it('throws 404 when deleting non-existent user', async () => {
      const repo = makeRepo({ findById: jest.fn().mockResolvedValue(null) });
      const service = new UserService(repo);

      await expect(service.deleteUser('bad-id')).rejects.toMatchObject({ statusCode: 404 });
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('AppError', () => {
    it('is an instance of Error', () => {
      const err = new AppError('test', 400);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('AppError');
      expect(err.message).toBe('test');
      expect(err.statusCode).toBe(400);
    });
  });
});
