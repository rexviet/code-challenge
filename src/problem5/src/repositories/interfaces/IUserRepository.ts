import { CreateUserDto, UpdateUserDto, User, UserFilters } from '../../models/user.model';
import { PaginatedData } from '../../types/response.types';

export interface IUserRepository {
  create(dto: CreateUserDto): Promise<User>;
  findAll(filters: UserFilters): Promise<PaginatedData<User>>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  update(id: string, dto: UpdateUserDto): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}
