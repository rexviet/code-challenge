import { NextFunction, Request, Response } from 'express';
import { CreateUserDto, UpdateUserDto, UserFilters } from '../models/user.model';
import { IUserService } from '../services/interfaces/IUserService';
import { sendError, sendPaginated, sendSuccess } from '../utils/response.util';
import { IUserController } from './interfaces/IUserController';

export class UserController implements IUserController {
  constructor(private readonly userService: IUserService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: CreateUserDto = req.body;
      const user = await this.userService.createUser(dto);
      sendSuccess(res, 'User created successfully', user, 201);
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: UserFilters = req.query as unknown as UserFilters;
      const result = await this.userService.listUsers(filters);
      sendPaginated(res, 'Users retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.getUserById(req.params.id);
      sendSuccess(res, 'User retrieved successfully', user);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: UpdateUserDto = req.body;
      const user = await this.userService.updateUser(req.params.id, dto);
      sendSuccess(res, 'User updated successfully', user);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.userService.deleteUser(req.params.id);
      sendSuccess(res, 'User deleted successfully');
    } catch (err) {
      next(err);
    }
  }
}
