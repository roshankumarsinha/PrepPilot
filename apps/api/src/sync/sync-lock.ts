import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';

/** Arbitrary constant naming the "sync" advisory lock across every PrepPilot process. */
const SYNC_LOCK_KEY = 7_100_001;

/** A held lock; call `release` exactly once. */
export interface HeldLock {
  release(): Promise<void>;
}

/**
 * Ensures only one sync runs at a time, across the API server, the CLI and (later) the MCP
 * process. Uses a Postgres session-level advisory lock, which Postgres frees automatically if
 * the holding process dies.
 */
@Injectable()
export class SyncLock {
  constructor(private readonly database: DatabaseService) {}

  /** Returns the lock, or null if another sync holds it. Never waits. */
  async tryAcquire(): Promise<HeldLock | null> {
    const client: PoolClient = await this.database.pool.connect();
    try {
      const { rows } = await client.query<{ locked: boolean }>(
        'select pg_try_advisory_lock($1) as locked',
        [SYNC_LOCK_KEY],
      );
      if (!rows[0]?.locked) {
        client.release();
        return null;
      }
    } catch (error) {
      client.release();
      throw error;
    }

    let released = false;
    return {
      release: async () => {
        if (released) return;
        released = true;
        try {
          await client.query('select pg_advisory_unlock($1)', [SYNC_LOCK_KEY]);
        } finally {
          client.release();
        }
      },
    };
  }
}
