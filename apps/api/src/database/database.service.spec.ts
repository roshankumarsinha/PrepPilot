import { Logger } from '@nestjs/common';
import { testEnv } from '../testing/test-env';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    // The pool connects lazily, so no database is needed to construct the service.
    service = new DatabaseService(testEnv());
  });

  afterEach(async () => {
    await service.onApplicationShutdown();
    jest.restoreAllMocks();
  });

  it('survives an idle connection error instead of crashing the process', () => {
    // Without a listener, EventEmitter throws on an 'error' event.
    expect(() =>
      service.pool.emit('error', new Error('terminating connection due to administrator command')),
    ).not.toThrow();
    expect(Logger.prototype.warn).toHaveBeenCalledWith(
      'Idle database connection lost: terminating connection due to administrator command',
    );
  });
});
