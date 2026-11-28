import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ENV } from '../config/config.module';
import * as schema from './schema';
import type { Env } from '../config/env';

export type Database = NodePgDatabase<typeof schema>;

/** Owns the Postgres connection pool and the Drizzle client built on it. */
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: Pool;
  readonly db: Database;

  constructor(@Inject(ENV) env: Env) {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 2_000,
    });
    // An idle client loses its connection when Postgres restarts or stops. pg reports that
    // as an 'error' event on the pool, which crashes the process if nobody listens. The pool
    // discards the broken client and reconnects on the next query, so a warning is enough.
    this.pool.on('error', (error) => {
      this.logger.warn(`Idle database connection lost: ${error.message}`);
    });
    this.db = drizzle({ client: this.pool, schema });
  }

  /** Runs a trivial query; resolves if the database answers, rejects otherwise. */
  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
