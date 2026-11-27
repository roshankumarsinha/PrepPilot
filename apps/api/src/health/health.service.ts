import { Injectable, Logger } from '@nestjs/common';
import type { DatabaseHealth, HealthResponse } from '@preppilot/shared';
import { DatabaseService } from '../database/database.service';
import { withTimeout } from './with-timeout';

export const DB_PING_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly database: DatabaseService) {}

  async check(): Promise<HealthResponse> {
    const db = await this.checkDatabase();
    return {
      status: db.status === 'up' ? 'ok' : 'degraded',
      db,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<DatabaseHealth> {
    const startedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - startedAt);
    try {
      await withTimeout(this.database.ping(), DB_PING_TIMEOUT_MS);
      return { status: 'up', latencyMs: elapsed() };
    } catch (error) {
      const message = describeError(error);
      this.logger.warn(`Database health check failed: ${message}`);
      return { status: 'down', latencyMs: elapsed(), error: message };
    }
  }
}

/** Finds the most specific message: drizzle wraps driver errors in `cause`, pg uses AggregateError. */
function describeError(error: unknown): string {
  if (error instanceof Error && error.cause !== undefined) {
    return describeError(error.cause);
  }
  if (error instanceof AggregateError && error.errors.length > 0) {
    // pg reports "connection refused" as an AggregateError (one entry per resolved address).
    return describeError(error.errors[0]);
  }
  if (error instanceof Error && error.message) return error.message;
  return String(error) || 'Unknown error';
}
