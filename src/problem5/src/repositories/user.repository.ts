import { DataSource, Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { CreateUserDto, UpdateUserDto, User, UserFilters } from '../models/user.model';
import { PaginatedData } from '../types/response.types';
import { IUserRepository } from './interfaces/IUserRepository';

export class UserRepository implements IUserRepository {
  private readonly repo: Repository<UserEntity>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(UserEntity);
  }

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.repo.create({
      name: dto.name,
      email: dto.email,
      role: dto.role ?? 'user',
    });
    return this.repo.save(user);
  }

  async findAll(filters: UserFilters): Promise<PaginatedData<User>> {
    const {
      name,
      email,
      role,
      page = 1,
      limit = 10,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = filters;

    const qb = this.repo
      .createQueryBuilder('user')
      .where('user.deleted_at IS NULL');

    if (name) qb.andWhere('user.name ILIKE :name', { name: `%${name}%` });
    if (email) qb.andWhere('user.email ILIKE :email', { email: `%${email}%` });
    if (role) qb.andWhere('user.role = :role', { role });

    qb.orderBy(`user.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return { items, total, page, limit, totalPages, hasNextPage: page < totalPages };
  }

  async findById(id: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.id = :id', { id })
      .andWhere('user.deleted_at IS NULL')
      .getOne();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .andWhere('user.deleted_at IS NULL')
      .getOne();
  }

  async update(id: string, dto: UpdateUserDto): Promise<User | null> {
    await this.repo
      .createQueryBuilder()
      .update(UserEntity)
      .set({ ...dto })
      .where('id = :id', { id })
      .andWhere('deleted_at IS NULL')
      .execute();

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(UserEntity)
      .set({ deleted_at: new Date() })
      .where('id = :id', { id })
      .andWhere('deleted_at IS NULL')
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
