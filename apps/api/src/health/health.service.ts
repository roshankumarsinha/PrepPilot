import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DependencyHealth, HealthResponse } from '@preppilot/shared';
import { DatabaseService } from '../database/database.service';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../embeddings/embedding.provider';
import { withTimeout } from './with-timeout';

export const PROBE_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly database: DatabaseService,
    @Inject(EMBEDDING_PROVIDER) private readonly embedder: EmbeddingProvider,
  ) {}

  async check(): Promise<HealthResponse> {
    const [db, ollama] = await Promise.all([
      this.probe('Database', () => this.database.ping()),
      this.probe('Ollama', async () => {
        const { available, error } = await this.embedder.checkAvailability();
        if (!available) throw new Error(error ?? 'Ollama is unavailable');
      }),
    ]);
    return {
      status: db.status === 'up' && ollama.status === 'up' ? 'ok' : 'degraded',
      db,
      ollama,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async probe(name: string, check: () => Promise<void>): Promise<DependencyHealth> {
    const startedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - startedAt);
    try {
      await withTimeout(check(), PROBE_TIMEOUT_MS);
      return { status: 'up', latencyMs: elapsed() };
    } catch (error) {
      const message = describeError(error);
      this.logger.warn(`${name} health check failed: ${message}`);
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
