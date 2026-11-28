import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthResponseSchema } from '@preppilot/shared';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { EMBEDDING_PROVIDER } from '../src/embeddings/embedding.provider';
import { FakeEmbeddingProvider } from './fakes';

/** Boots the whole app against the real Postgres (docker-compose locally, a service container in CI). */
describe('GET /health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // Ollama is not available in CI; its own probe is covered by unit tests.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMBEDDING_PROVIDER)
      .useValue(new FakeEmbeddingProvider())
      .compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 and reports the database and embeddings as up', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    const body = HealthResponseSchema.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.db.status).toBe('up');
    expect(body.ollama.status).toBe('up');
  });
});
