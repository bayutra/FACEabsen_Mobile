import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/app-config (GET)', () => {
    return request(app.getHttpServer())
      .get('/app-config')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          minVersion: expect.any(String),
          latestVersion: expect.any(String),
          message: expect.any(String),
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
