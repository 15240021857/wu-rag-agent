import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { setupApp } from './../src/setup-app.js';

describe('Health (e2e)', () => {
  let app: INestApplication<Server>;

  beforeEach(async () => {
    process.env.JWT_SECRET ??= 'e2e-test-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  it('GET /api/health', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({
        code: 0,
        message: 'ok',
        data: { status: 'ok' },
      });
  });

  it('GET /api/docs-json lists system routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const paths = Object.keys(response.body.paths as Record<string, unknown>);
    expect(paths.some((item) => item.endsWith('/system/companies'))).toBe(true);
    expect(
      paths.some((item) => item.endsWith('/system/users/{id}/password')),
    ).toBe(true);
    expect(paths.some((item) => item.endsWith('/auth/login'))).toBe(true);
    expect(paths.some((item) => item.endsWith('/auth/profile'))).toBe(true);
    expect(paths.some((item) => item.endsWith('/rag/knowledges'))).toBe(true);
    expect(paths.some((item) => item.endsWith('/rag/chat'))).toBe(true);
    expect(
      paths.some((item) => item.endsWith('/rag/documents/{id}/detail')),
    ).toBe(true);
  });

  it('GET /api/auth/profile without a token returns 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/profile')
      .expect(401);

    expect(response.body).toEqual({
      code: 401,
      message: '未登录',
      data: null,
    });
  });

  it('POST /api/auth/login rejects an empty body', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({})
      .expect(400);

    expect(response.body.code).toBe(400);
    expect(response.body.data).toBeNull();
  });

  it('GET /api/missing returns the error envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/missing')
      .expect(404);

    expect(response.body).toMatchObject({
      code: 404,
      data: null,
    });
    expect(typeof response.body.message).toBe('string');
  });

  afterEach(async () => {
    await app.close();
  });
});
