import { NestFactory } from '@nestjs/core';
import { SyncCliModule } from './sync-cli.module';
import { SyncService } from './sync/sync.service';
import type { RepoSyncResult } from './sync/sync.types';

/**
 * `pnpm sync [repo]`: syncs every repo (or one) and prints the result. Exits with code 1 if
 * any repo failed or another sync is already running.
 */
async function main(): Promise<void> {
  const repo = process.argv[2];
  const app = await NestFactory.createApplicationContext(SyncCliModule);
  app.useLogger(['log', 'warn', 'error']);
  app.enableShutdownHooks();
  try {
    const results = await app.get(SyncService).runNow({ trigger: 'cli', repo });
    printTable(results);
    if (results.some((r) => r.status === 'failed')) process.exitCode = 1;
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

function printTable(results: RepoSyncResult[]): void {
  console.table(
    results.map((r) => ({
      repo: r.repo,
      status: r.status,
      mode: r.mode,
      commits: `${r.fromSha?.slice(0, 7) ?? '(new)'} → ${r.toSha?.slice(0, 7) ?? '?'}`,
      'files changed': r.filesChanged,
      'chunks +': r.chunksAdded,
      'chunks −': r.chunksRemoved,
      embedded: r.chunksEmbedded,
      ms: r.durationMs,
      ...(r.error ? { error: r.error } : {}),
    })),
  );
}

void main();
