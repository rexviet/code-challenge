import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from '../utils/cache';
import { AppError } from '../utils/errors';
import { CreateUserDto, UpdateUserDto, User, UserFilters } from '../models/user.model';
import { IUserRepository } from '../repositories/interfaces/IUserRepository';
import { PaginatedData } from '../types/response.types';
import { IUserService } from './interfaces/IUserService';

const USER_KEY = (id: string) => `user:v1:${id}`;
const LIST_KEY = (filters: UserFilters) => `users:v1:${JSON.stringify(filters)}`;

export class UserService implements IUserService {
  constructor(private readonly userRepository: IUserRepository) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new AppError('Email already in use', 409);
    }
    const user = await this.userRepository.create(dto);
    await cacheDelPattern('users:v1:*');
    return user;
  }

  async listUsers(filters: UserFilters): Promise<PaginatedData<User>> {
    const key = LIST_KEY(filters);
    const cached = await cacheGet<PaginatedData<User>>(key);
    if (cached) return cached;

    const result = await this.userRepository.findAll(filters);
    await cacheSet(key, result);
    return result;
  }

  async getUserById(id: string): Promise<User> {
    const key = USER_KEY(id);
    const cached = await cacheGet<User>(key);
    if (cached) return cached;

    const user = await this.userRepository.findById(id);
    if (!user) throw new AppError('User not found', 404);

    await cacheSet(key, user);
    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    await this.getUserById(id);

    if (dto.email) {
      const existing = await this.userRepository.findByEmail(dto.email);
      if (existing && existing.id !== id) {
        throw new AppError('Email already in use', 409);
      }
    }

    const updated = await this.userRepository.update(id, dto);
    if (!updated) throw new AppError('User not found', 404);

    await cacheDel(USER_KEY(id));
    await cacheDelPattern('users:v1:*');
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await this.getUserById(id);
    await this.userRepository.delete(id);
    await cacheDel(USER_KEY(id));
    await cacheDelPattern('users:v1:*');
  }
}
