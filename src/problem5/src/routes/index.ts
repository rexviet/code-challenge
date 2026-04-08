import { Router } from 'express';
import { AppDataSource } from '../config/data-source';
import { UserController } from '../controllers/user.controller';
import { UserRepository } from '../repositories/user.repository';
import { UserService } from '../services/user.service';
import { createUserRouter } from './user.routes';

// Composition root: wire up the dependency graph
const userRepository = new UserRepository(AppDataSource);
const userService = new UserService(userRepository);
const userController = new UserController(userService);

const router = Router();
router.use('/users', createUserRouter(userController));

export default router;
