import { Test } from '@nestjs/testing';
import { HealthResponseSchema } from '@preppilot/shared';
import { DatabaseService } from '../database/database.service';
import { EMBEDDING_PROVIDER } from '../embeddings/embedding.provider';
import { HealthService, PROBE_TIMEOUT_MS } from './health.service';

describe('HealthService', () => {
  const ping = jest.fn<Promise<void>, []>();
  const checkAvailability = jest.fn<Promise<{ available: boolean; error?: string }>, []>();
  let service: HealthService;

  beforeEach(async () => {
    ping.mockReset().mockResolvedValue(undefined);
    checkAvailability.mockReset().mockResolvedValue({ available: true });
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DatabaseService, useValue: { ping } },
        { provide: EMBEDDING_PROVIDER, useValue: { checkAvailability } },
      ],
    }).compile();
    moduleRef.useLogger(false);
    service = moduleRef.get(HealthService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports ok when the database and Ollama answer', async () => {
    const result = await service.check();

    expect(HealthResponseSchema.parse(result)).toEqual(result);
    expect(result.status).toBe('ok');
    expect(result.db.status).toBe('up');
    expect(result.ollama.status).toBe('up');
  });

  it('reports degraded with the error message when the database fails', async () => {
    ping.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.db).toMatchObject({
      status: 'down',
      error: 'connect ECONNREFUSED 127.0.0.1:5432',
    });
  });

  it('reports degraded with the fix when the embedding model is missing', async () => {
    checkAvailability.mockResolvedValue({
      available: false,
      error: 'run: ollama pull nomic-embed-text',
    });

    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.db.status).toBe('up');
    expect(result.ollama).toMatchObject({
      status: 'down',
      error: 'run: ollama pull nomic-embed-text',
    });
  });

  it('unwraps AggregateError into its first cause', async () => {
    ping.mockRejectedValue(new AggregateError([new Error('connect ECONNREFUSED ::1:5432')]));
    expect((await service.check()).db.error).toBe('connect ECONNREFUSED ::1:5432');
  });

  it('reports the root cause when the error is wrapped', async () => {
    const driverError = new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:5432')]);
    ping.mockRejectedValue(new Error('Failed query: select 1', { cause: driverError }));
    expect((await service.check()).db.error).toBe('connect ECONNREFUSED 127.0.0.1:5432');
  });

  it('reports degraded when the database does not answer in time', async () => {
    jest.useFakeTimers();
    ping.mockReturnValue(new Promise(() => undefined));

    const pending = service.check();
    await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);
    const result = await pending;

    expect(result.status).toBe('degraded');
    expect(result.db.error).toBe(`Timed out after ${PROBE_TIMEOUT_MS} ms`);
  });
});
