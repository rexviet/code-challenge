import { Router } from 'express';
import { IUserController } from '../controllers/interfaces/IUserController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/permission.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createUserSchema,
  getUserSchema,
  listUsersSchema,
  updateUserSchema,
} from '../validators/user.validator';

export function createUserRouter(controller: IUserController): Router {
  const router = Router();

  /**
   * @openapi
   * /users:
   *   post:
   *     summary: Create a new user
   *     tags: [Users]
   *     security:
   *       - mockBearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateUserBody'
   *     responses:
   *       201:
   *         description: User created
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/User'
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Email already in use
   */
  router.post(
    '/',
    authenticate,
    requireRole('admin', 'user'),
    validate(createUserSchema),
    controller.create.bind(controller),
  );

  /**
   * @openapi
   * /users:
   *   get:
   *     summary: List users with optional filters and sorting
   *     tags: [Users]
   *     security:
   *       - mockBearerAuth: []
   *     parameters:
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *       - in: query
   *         name: email
   *         schema:
   *           type: string
   *       - in: query
   *         name: role
   *         schema:
   *           type: string
   *           enum: [user, admin]
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 10
   *           maximum: 100
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [name, email, created_at, updated_at]
   *           default: created_at
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [ASC, DESC]
   *           default: DESC
   *     responses:
   *       200:
   *         description: Paginated list of users
   */
  router.get(
    '/',
    authenticate,
    requireRole('admin', 'user'),
    validate(listUsersSchema),
    controller.list.bind(controller),
  );

  /**
   * @openapi
   * /users/{id}:
   *   get:
   *     summary: Get a user by ID
   *     tags: [Users]
   *     security:
   *       - mockBearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: User found
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/SuccessResponse'
   *                 - type: object
   *                   properties:
   *                     data:
   *                       $ref: '#/components/schemas/User'
   *       404:
   *         description: User not found
   */
  router.get(
    '/:id',
    authenticate,
    requireRole('admin', 'user'),
    validate(getUserSchema),
    controller.getById.bind(controller),
  );

  /**
   * @openapi
   * /users/{id}:
   *   patch:
   *     summary: Partially update a user (admin only)
   *     tags: [Users]
   *     security:
   *       - mockBearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateUserBody'
   *     responses:
   *       200:
   *         description: User updated
   *       403:
   *         description: Forbidden – admin only
   *       404:
   *         description: User not found
   */
  router.patch(
    '/:id',
    authenticate,
    requireRole('admin'),
    validate(updateUserSchema),
    controller.update.bind(controller),
  );

  /**
   * @openapi
   * /users/{id}:
   *   delete:
   *     summary: Delete a user (admin only)
   *     tags: [Users]
   *     security:
   *       - mockBearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *     responses:
   *       200:
   *         description: User deleted
   *       403:
   *         description: Forbidden – admin only
   *       404:
   *         description: User not found
   */
  router.delete(
    '/:id',
    authenticate,
    requireRole('admin'),
    validate(getUserSchema),
    controller.delete.bind(controller),
  );

  return router;
}
