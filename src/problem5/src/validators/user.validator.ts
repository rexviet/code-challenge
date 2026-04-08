import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(255),
    email: z.string().trim().email('Invalid email address'),
    role: z.enum(['user', 'admin']).optional().default('user'),
  }),
});

export const updateUserSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(255).optional(),
      email: z.string().trim().email('Invalid email address').optional(),
      role: z.enum(['user', 'admin']).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    name: z.string().trim().optional(),
    email: z.string().trim().optional(),
    role: z.enum(['user', 'admin']).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
    sortBy: z.enum(['name', 'email', 'created_at', 'updated_at']).optional().default('created_at'),
    sortOrder: z.enum(['ASC', 'DESC']).optional().default('DESC'),
  }),
});
