import { Test } from '@nestjs/testing';
import { HealthResponseSchema } from '@preppilot/shared';
import { DatabaseService } from '../database/database.service';
import { DB_PING_TIMEOUT_MS, HealthService } from './health.service';

describe('HealthService', () => {
  const ping = jest.fn<Promise<void>, []>();
  let service: HealthService;

  beforeEach(async () => {
    ping.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: DatabaseService, useValue: { ping } }],
    }).compile();
    moduleRef.useLogger(false);
    service = moduleRef.get(HealthService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports ok when the database answers', async () => {
    ping.mockResolvedValue(undefined);

    const result = await service.check();

    expect(HealthResponseSchema.parse(result)).toEqual(result);
    expect(result.status).toBe('ok');
    expect(result.db.status).toBe('up');
    expect(result.db.error).toBeUndefined();
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

  it('unwraps AggregateError into its first cause', async () => {
    ping.mockRejectedValue(new AggregateError([new Error('connect ECONNREFUSED ::1:5432')]));

    const result = await service.check();

    expect(result.db.error).toBe('connect ECONNREFUSED ::1:5432');
  });

  it('reports the root cause when the error is wrapped', async () => {
    const driverError = new AggregateError([new Error('connect ECONNREFUSED 127.0.0.1:5432')]);
    ping.mockRejectedValue(new Error('Failed query: select 1', { cause: driverError }));

    const result = await service.check();

    expect(result.db.error).toBe('connect ECONNREFUSED 127.0.0.1:5432');
  });

  it('reports degraded when the database does not answer in time', async () => {
    jest.useFakeTimers();
    ping.mockReturnValue(new Promise(() => undefined));

    const pending = service.check();
    await jest.advanceTimersByTimeAsync(DB_PING_TIMEOUT_MS);
    const result = await pending;

    expect(result.status).toBe('degraded');
    expect(result.db.error).toBe(`Timed out after ${DB_PING_TIMEOUT_MS} ms`);
  });
});
