export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CreateUserDto {
  name: string;
  email: string;
  role?: UserRole;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  role?: UserRole;
}

export type UserSortField = 'name' | 'email' | 'created_at' | 'updated_at';
export type SortOrder = 'ASC' | 'DESC';

export interface UserFilters {
  name?: string;
  email?: string;
  role?: UserRole;
  page?: number;
  limit?: number;
  sortBy?: UserSortField;
  sortOrder?: SortOrder;
}
