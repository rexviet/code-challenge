import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CRUD API – Problem 5',
      version: '1.0.0',
      description: 'RESTful CRUD API with Express, TypeScript, and PostgreSQL',
    },
    servers: [{ url: `${env.baseUrl}/api/v1` }],
    components: {
      securitySchemes: {
        mockBearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Mock token format: `mock-{role}-{userId}`. E.g. `mock-admin-user1` or `mock-user-user2`',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['user', 'admin'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        CreateUserBody: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['user', 'admin'], default: 'user' },
          },
        },
        UpdateUserBody: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['user', 'admin'] },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    security: [{ mockBearerAuth: [] }],
  },
  // __dirname is dist/config in production, src/config in ts-node — both cases resolved correctly
  apis: [
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../routes/*.js'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
