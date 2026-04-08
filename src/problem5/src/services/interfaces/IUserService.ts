import { CreateUserDto, UpdateUserDto, User, UserFilters } from '../../models/user.model';
import { PaginatedData } from '../../types/response.types';

export interface IUserService {
  createUser(dto: CreateUserDto): Promise<User>;
  listUsers(filters: UserFilters): Promise<PaginatedData<User>>;
  getUserById(id: string): Promise<User>;
  updateUser(id: string, dto: UpdateUserDto): Promise<User>;
  deleteUser(id: string): Promise<void>;
}
