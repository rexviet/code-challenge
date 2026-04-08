# Problem 5 — RESTful CRUD API

> **Production-style** Express + TypeScript + PostgreSQL service demonstrating clean architecture, dependency injection, Redis caching, RBAC, and full observability — all runnable in one command.

---

## At a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TECH RADAR                                  │
│                                                                     │
│  Core          │  Express 4 · TypeScript 5 · Node.js 24             │
│  Database      │  PostgreSQL 18 · TypeORM · Versioned Migrations    │
│  Caching       │  Redis 7 · ioredis · Cache-aside pattern           │
│  Validation    │  Zod (body / params / query)                       │
│  Auth          │  Mock JWT-replaceable · RBAC middleware factory     │
│  Security      │  Helmet · CORS · Rate limiting · No stack leaks    │
│  Observability │  Winston structured logs · Swagger UI / OpenAPI    │
│  Resilience    │  Graceful shutdown · AppError · Global error handler│
│  Infra         │  Docker · Docker Compose · Healthchecks            │
│  Testing       │  Jest · 10 suites · 68 cases · 75% statement cov.  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

### Request Flow

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                    Middleware Chain                  │
│                                                     │
│  rateLimit ──► authenticate ──► requireRole ──►     │
│  validate(Zod) ──► controller                       │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────┐       ┌──────────────────┐
│   Controller     │──────►│    Service       │
│                  │       │                  │
│  - Parse HTTP    │       │  - Business      │
│  - Call service  │       │    logic         │
│  - Return JSON   │       │  - Cache-aside   │
└──────────────────┘       │  - Conflict      │
                           │    checks        │
                           └────────┬─────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             ┌────────────┐  ┌───────────┐  ┌───────────┐
             │ Repository │  │  Redis    │  │ AppError  │
             │            │  │  Cache    │  │ (thrown)  │
             │ TypeORM QB │  │ ioredis   │  └───────────┘
             └─────┬──────┘  └───────────┘
                   │
                   ▼
             ┌───────────┐
             │ PostgreSQL │
             └───────────┘
```

### Dependency Injection

Each layer depends on the **interface** of the layer below — never the concrete class:

```
UserController  ──depends on──►  IUserService
UserService     ──depends on──►  IUserRepository
UserRepository  ──depends on──►  DataSource (TypeORM)
```

Wiring is done in a single **composition root** (`src/routes/index.ts`):

```typescript
const userRepository = new UserRepository(dataSource);
const userService    = new UserService(userRepository);
const userController = new UserController(userService);
```

Swapping PostgreSQL for another database only touches the composition root.

---

## Key Design Decisions

### 1. Redis Cache-aside with Pattern Invalidation

```
GET /users/:id
    │
    ├─► Cache hit?  ──YES──► return cached value (< 1ms)
    │
    └─► Cache miss ──────► query PostgreSQL
                            │
                            └──► store in Redis (TTL=300s)
                                 ──► return result

POST/PUT/DELETE /users/:id
    └──► invalidate user:v1:{id}
         + pattern-delete users:v1:*   (list cache)
```

Cache failures are **non-fatal** — all errors are silently swallowed so the API degrades gracefully when Redis is unavailable.

### 2. Soft Delete

```sql
-- Every query scopes to non-deleted rows
WHERE deleted_at IS NULL

-- "Delete" sets a timestamp, never removes data
UPDATE users SET deleted_at = NOW() WHERE id = ?
```

An indexed `deleted_at` column keeps query performance constant even as the table grows.

### 3. TypeORM Migrations (schema-as-code)

All schema changes go through versioned, reversible migrations — there is no manual SQL initialization file:

```
migrations/
├── 1775661024813-CreateUsersTable.ts     ← initial schema
└── 1775661024814-AddDeletedAtToUsers.ts  ← soft delete column
```

Each migration has an `up` and `down` method. TypeORM tracks which migrations have run in a `migrations` table, so schema drift is impossible.

### 4. Auth Middleware is Swappable

```typescript
// auth.middleware.ts  — swap just this file for real JWT
export function authenticate(req, res, next) {
  // Currently: parse mock-{role}-{userId}
  // Replace with: jwt.verify(token, SECRET) ← zero route changes
  req.user = { id, role };
  next();
}
```

### 5. RBAC Middleware Factory

```typescript
// Declarative, composable
router.put('/:id',  authenticate, requireRole('admin'),        ...)
router.get('/',     authenticate, requireRole('user','admin'),  ...)
```

---

## Project Structure

```
src/problem5/
├── src/
│   ├── app/
│   │   ├── app.ts              # Express setup, middleware registration
│   │   └── server.ts           # Entry point — connect DB, run migrations, graceful shutdown
│   ├── config/
│   │   ├── env.ts              # Centralised env parsing + fail-fast validation
│   │   ├── database.ts         # TypeORM DataSource (pg pool)
│   │   ├── data-source.ts      # CLI DataSource for migration commands
│   │   └── swagger.ts          # OpenAPI spec config
│   ├── controllers/
│   │   ├── interfaces/IUserController.ts
│   │   └── user.controller.ts
│   ├── services/
│   │   ├── interfaces/IUserService.ts
│   │   └── user.service.ts     # Cache-aside, conflict checks, business logic
│   ├── repositories/
│   │   ├── interfaces/IUserRepository.ts
│   │   └── user.repository.ts  # TypeORM QueryBuilder, soft delete
│   ├── entities/
│   │   └── user.entity.ts      # TypeORM entity with indexes + decorators
│   ├── migrations/             # Versioned, reversible schema migrations
│   ├── routes/
│   │   ├── user.routes.ts      # Route definitions + Swagger JSDoc
│   │   └── index.ts            # Composition root (DI wiring)
│   ├── middlewares/
│   │   ├── auth.middleware.ts          # Mock auth (JWT-replaceable)
│   │   ├── permission.middleware.ts    # RBAC factory: requireRole(...)
│   │   ├── validation.middleware.ts    # Zod middleware (body/params/query)
│   │   ├── rateLimit.middleware.ts     # express-rate-limit
│   │   └── error.middleware.ts         # Global error handler
│   ├── validators/
│   │   └── user.validator.ts           # Zod schemas per endpoint
│   ├── models/
│   │   └── user.model.ts               # Pure TS types and DTOs
│   ├── types/
│   │   ├── express.d.ts                # Augment Request with req.user
│   │   └── response.types.ts           # Shared PaginatedData<T> type
│   └── utils/
│       ├── cache.ts                    # Redis helpers (get/set/del/pattern)
│       ├── errors.ts                   # AppError with statusCode
│       ├── logger.ts                   # Winston structured logger
│       └── response.util.ts            # sendSuccess / sendError
├── __tests__/
│   ├── app.integration.test.ts         # End-to-end HTTP tests (9 cases)
│   ├── user.service.test.ts            # Service unit tests (12 cases)
│   ├── user.validator.test.ts          # Zod schema tests (11 cases)
│   ├── cache.service.test.ts           # Cache utility tests (8 cases)
│   ├── user.controller.test.ts         # Controller unit tests (7 cases)
│   ├── auth.middleware.test.ts         # Auth middleware tests (6 cases)
│   ├── pagination.test.ts              # Pagination logic tests (4 cases)
│   ├── soft.delete.test.ts             # Soft delete behaviour (4 cases)
│   ├── permission.middleware.test.ts   # RBAC tests (4 cases)
│   └── validation.middleware.test.ts   # Validation middleware (3 cases)
├── Dockerfile
├── docker-compose.yml                  # API + PostgreSQL + Redis
└── .env.example
```

---

## API Endpoints

Base path: `/api/v1`

| Method   | Path                 | Description                     | Auth     | Role          |
|----------|----------------------|---------------------------------|----------|---------------|
| `POST`   | `/api/v1/users`      | Create user                     | Required | user, admin   |
| `GET`    | `/api/v1/users`      | List users (filters+pagination) | Required | user, admin   |
| `GET`    | `/api/v1/users/:id`  | Get user by ID                  | Required | user, admin   |
| `PUT`    | `/api/v1/users/:id`  | Update user                     | Required | admin only    |
| `DELETE` | `/api/v1/users/:id`  | Soft-delete user                | Required | admin only    |
| `GET`    | `/health`            | Health check (DB ping)          | None     | —             |

### `GET /api/v1/users` — Filters & Pagination

| Param       | Type                                              | Default      |
|-------------|---------------------------------------------------|--------------|
| `name`      | string (partial match, case-insensitive)          | —            |
| `email`     | string (partial match, case-insensitive)          | —            |
| `role`      | `user` \| `admin`                                 | —            |
| `page`      | number                                            | `1`          |
| `limit`     | number (max 100)                                  | `10`         |
| `sortBy`    | `name` \| `email` \| `created_at` \| `updated_at` | `created_at` |
| `sortOrder` | `ASC` \| `DESC`                                   | `DESC`       |

### Response Format

```
┌────────────────────────────────┐  ┌────────────────────────────────┐
│         SUCCESS                │  │          ERROR                 │
├────────────────────────────────┤  ├────────────────────────────────┤
│ {                              │  │ {                              │
│   "success": true,             │  │   "success": false,            │
│   "message": "...",            │  │   "data": { ... }              │
│ }                              │  │   "errors": [                  │
│                                │  │     { "field": "email",        │
│                                │  │       "message": "..." }       │
│                                │  │   ]                            │
│                                │  │ }                              │
└────────────────────────────────┘  └────────────────────────────────┘
```

---

## Running Locally

**Prerequisites**: Node.js 24.x, PostgreSQL, Redis

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DB and Redis credentials

# 3. Run migrations (creates all tables)
npm run migration:run

# 4. Start dev server (hot reload via ts-node-dev)
npm run dev

# 5. Or build and run production
npm run build && npm start
```

---

## Database Migrations

Schema is fully managed through TypeORM migrations — there is no manual SQL file to run.

```bash
# Apply all pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Generate a new migration from entity changes
npm run migration:generate src/migrations/MigrationName
```

The `migrations` table in PostgreSQL tracks which have already been applied.

---

## Running with Docker Compose

The fastest way — starts API, PostgreSQL 18, and Redis 7 with healthchecks:

```bash
# 1. Configure environment
cp .env.example .env

# 2. Build and start all services
docker compose up --build

# API     → http://localhost:3003
# Swagger → http://localhost:3003/docs

# 3. Tear down (removes volumes)
docker compose down -v
```

Migrations run automatically on container startup.

---

## Environment Variables

| Variable               | Description                  | Default               |
|------------------------|------------------------------|-----------------------|
| `PORT`                 | API port                     | `3000`                |
| `NODE_ENV`             | Environment                  | `development`         |
| `DB_HOST`              | PostgreSQL host              | `localhost`           |
| `DB_PORT`              | PostgreSQL port              | `5432`                |
| `DB_USER`              | PostgreSQL user              | —                     |
| `DB_PASSWORD`          | PostgreSQL password          | —                     |
| `DB_NAME`              | Database name                | —                     |
| `REDIS_HOST`           | Redis host                   | `localhost`           |
| `REDIS_PORT`           | Redis port                   | `6379`                |
| `REDIS_TTL`            | Cache TTL in seconds         | `300`                 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window            | `900000` (15 min)     |
| `RATE_LIMIT_MAX`       | Max requests per window      | `100`                 |
| `MOCK_AUTH_ENABLED`    | Enable mock auth             | `true`                |
| `ALLOWED_ORIGINS`      | CORS allowed origins (CSV)   | `http://localhost:3000` |

Missing required variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) cause a hard crash at startup with a clear error message.

---

## Authentication

Mock auth is structured to be **drop-in replaceable** with real JWT:

```bash
# Admin token
Authorization: Bearer mock-admin-user1

# Regular user token
Authorization: Bearer mock-user-user2
```

To upgrade to real JWT: edit only `src/middlewares/auth.middleware.ts`. Routes, controllers, and services are untouched.

---

## Security

Multiple layers of security are applied:

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer            │  Mechanism                                   │
├──────────────────────────────────────────────────────────────────┤
│  HTTP headers     │  Helmet — sets CSP, HSTS, X-Frame-Options,  │
│                   │  X-Content-Type-Options, etc.                │
├──────────────────────────────────────────────────────────────────┤
│  CORS             │  Allowlist-based origins from env config.    │
│                   │  Only GET/POST/PUT/PATCH/DELETE/OPTIONS.     │
├──────────────────────────────────────────────────────────────────┤
│  Rate limiting    │  express-rate-limit on all /api/* routes.    │
│                   │  Returns 429 with Retry-After header.        │
│                   │  Window and max configurable via env.        │
├──────────────────────────────────────────────────────────────────┤
│  Authentication   │  Every /api/* route requires a valid token.  │
│                   │  Returns 401 on missing/malformed header.    │
├──────────────────────────────────────────────────────────────────┤
│  Authorization    │  RBAC enforced per route via requireRole().  │
│                   │  Mutations (PUT/DELETE) are admin-only.      │
│                   │  Returns 403 on insufficient role.           │
├──────────────────────────────────────────────────────────────────┤
│  Input validation │  Zod validates all body/params/query before  │
│                   │  controller logic runs. Returns structured   │
│                   │  400 errors with per-field messages.         │
├──────────────────────────────────────────────────────────────────┤
│  Error handling   │  Global error handler never leaks stack      │
│                   │  traces in production. AppError carries      │
│                   │  only a safe message + status code.          │
├──────────────────────────────────────────────────────────────────┤
│  Secrets          │  No hardcoded credentials. All config comes  │
│                   │  from env — required vars fail fast at boot. │
└──────────────────────────────────────────────────────────────────┘
```

---

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` to ensure no in-flight requests are dropped and all resources are released cleanly:

```
Signal received (SIGTERM / SIGINT)
    │
    ▼
server.close()          ← stop accepting new connections
    │                      wait for active requests to finish
    ▼
AppDataSource.destroy() ← close all PostgreSQL pool connections
    │
    ▼
disconnectCache()       ← send QUIT to Redis, await ACK
    │
    ▼
process.exit(0)         ← clean exit

(if any step hangs > 10s → force process.exit(1))
```

This prevents connection leaks in Kubernetes/Docker environments where `SIGTERM` is sent before the pod is replaced. The 10-second hard timeout guards against a shutdown that stalls indefinitely.

---

## API Documentation

After starting the server:

- **Swagger UI**: `http://localhost:3000/docs`
- **OpenAPI JSON**: `http://localhost:3000/docs.json`

---

## Testing

```bash
npm test                  # run all 10 suites
npm run test:coverage     # run with Istanbul coverage report
```

### Test Suites (68 cases total, all passing)

```
Suite                          │ Cases │ What it covers
───────────────────────────────┼───────┼──────────────────────────────────────
user.service.test              │  12   │ createUser, listUsers, getUserById,
                               │       │ updateUser, deleteUser — happy path
                               │       │ + duplicate email + not-found errors
user.validator.test            │  11   │ Zod schema: valid/invalid body, params,
                               │       │ query — boundary values, bad UUIDs
cache.service.test             │   8   │ get/set/del/pattern, TTL, miss returns
                               │       │ null, failure is non-fatal
app.integration.test           │   9   │ Full HTTP round-trips via supertest —
                               │       │ health, auth, CRUD endpoints
user.controller.test           │   7   │ Controller delegates to service,
                               │       │ maps responses and status codes
auth.middleware.test           │   6   │ Valid tokens, missing header, bad role,
                               │       │ mock disabled path
pagination.test                │   4   │ totalPages, hasNextPage edge cases
soft.delete.test               │   4   │ deleted_at set, item not returned in
                               │       │ list/getById after delete
permission.middleware.test     │   4   │ requireRole allows/denies correctly,
                               │       │ unauthenticated returns 401
validation.middleware.test     │   3   │ Zod errors mapped to structured 400,
                               │       │ valid requests pass through
───────────────────────────────┼───────┼──────────────────────────────────────
Total                          │  68   │ 10 suites, 0 failures
```

### Coverage Report

```
File area          │ Statements │ Branches │ Functions │ Lines
───────────────────┼────────────┼──────────┼───────────┼──────
services           │    97.77%  │   93.75% │   100.00% │ 100%
validators         │   100.00%  │  100.00% │   100.00% │ 100%
entities           │   100.00%  │  100.00% │   100.00% │ 100%
routes             │   100.00%  │  100.00% │   100.00% │ 100%
middlewares        │    86.15%  │   81.81% │    87.50% │  85%
controllers        │    88.46%  │  100.00% │   100.00% │  88%
app                │    96.77%  │  100.00% │    66.66% │ 100%
utils              │    60.65%  │   31.03% │    64.28% │  62%
───────────────────┼────────────┼──────────┼───────────┼──────
Overall            │    75.00%  │   55.08% │    63.15% │  76%
```

Low coverage in `utils/cache.ts` and `config/database.ts` is expected — these modules require a live Redis/PostgreSQL connection and are exercised by integration tests, not unit tests.
