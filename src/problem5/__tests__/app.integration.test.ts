import request from 'supertest';
import app from '../src/app/app';
import { AppDataSource } from '../src/config/data-source';

// Mock the DataSource so health check tests don't need a real DB
jest.mock('../src/config/data-source', () => ({
  AppDataSource: {
    query: jest.fn(),
    getRepository: jest.fn().mockReturnValue({
      createQueryBuilder: jest.fn(),
    }),
    initialize: jest.fn(),
    destroy: jest.fn(),
  },
}));

const mockedDataSource = jest.mocked(AppDataSource);

describe('Helmet — security headers', () => {
  it('sets X-Content-Type-Options header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('removes X-Powered-By header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS headers', () => {
  it('returns CORS headers for allowed origin', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('responds to preflight OPTIONS request', async () => {
    const res = await request(app)
      .options('/api/v1/users')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toMatch(/GET/);
  });
});

describe('GET /health', () => {
  it('returns 200 and db: connected when DB is reachable', async () => {
    (mockedDataSource.query as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, db: 'connected' });
  });

  it('returns 503 and db: disconnected when DB is unreachable', async () => {
    (mockedDataSource.query as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, db: 'disconnected' });
  });
});

describe('API versioning', () => {
  it('mounts routes under /api/v1', async () => {
    // Without auth token, should get 401 (not 404) — meaning route exists under /api/v1
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('returns 404 for legacy /api/users path', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(404);
  });
});
