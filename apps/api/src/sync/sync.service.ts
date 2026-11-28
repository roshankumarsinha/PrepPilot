import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import type { RepoRow } from '../database/schema';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../embeddings/embedding.provider';
import { GitClient } from '../git/git.client';
import { isSupportedFile, processDocument } from '../ingestion/parse-document';
import { createFileMatcher, type FileMatcher } from '../repos-config/file-matcher';
import { loadReposConfig, repoConfigHash } from '../repos-config/repos-config.loader';
import type { RepoConfig } from '../repos-config/repos-config.schema';
import { planChunkChanges } from './chunk-plan';
import { IndexRepository, type RunCounts, type StoredDocument } from './index.repository';
import { SyncLock, type HeldLock } from './sync-lock';
import {
  SyncBusyError,
  UnknownRepoError,
  type RepoSyncResult,
  type SyncOptions,
} from './sync.types';

/** Which files to (re)index and which documents to delete in one repo sync. */
interface WorkList {
  mode: RepoSyncResult['mode'];
  process: string[];
  remove: string[];
}

/**
 * Keeps the index in step with the notes repos. For each repo it updates the local clone,
 * works out which files changed since the last indexed commit, and re-chunks only those,
 * embedding only chunks whose text is new.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(EMBEDDING_PROVIDER) private readonly embedder: EmbeddingProvider,
    private readonly git: GitClient,
    private readonly index: IndexRepository,
    private readonly lock: SyncLock,
  ) {}

  /** Runs a sync and waits for it. Used by the CLI, the scheduler and tests. */
  async runNow(options: SyncOptions): Promise<RepoSyncResult[]> {
    const configs = await this.selectRepos(options.repo);
    const held = await this.lock.tryAcquire();
    if (!held) throw new SyncBusyError();
    return this.runLocked(held, configs, options);
  }

  /**
   * Starts a sync in the background and returns once the lock is held, so the caller learns
   * immediately whether it started. Progress is visible in the sync log.
   */
  async start(options: SyncOptions): Promise<string[]> {
    const configs = await this.selectRepos(options.repo);
    const held = await this.lock.tryAcquire();
    if (!held) throw new SyncBusyError();
    this.runLocked(held, configs, options).catch((error: unknown) => {
      this.logger.error(`Background sync failed: ${(error as Error).message}`);
    });
    return configs.map((c) => c.name);
  }

  private async selectRepos(name?: string): Promise<RepoConfig[]> {
    const configs = await loadReposConfig(this.env.REPOS_CONFIG);
    if (name === undefined) return configs;
    const match = configs.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!match) throw new UnknownRepoError(name);
    return [match];
  }

  private async runLocked(
    held: HeldLock,
    configs: RepoConfig[],
    options: SyncOptions,
  ): Promise<RepoSyncResult[]> {
    try {
      if (options.repo === undefined) {
        const removed = await this.index.deleteReposExcept(configs.map((c) => c.name));
        if (removed.length > 0)
          this.logger.log(`Removed repos no longer in repos.yaml: ${removed.join(', ')}`);
      }
      const rows = await this.index.upsertRepos(configs);
      const results: RepoSyncResult[] = [];
      for (const config of configs) {
        const row = rows.get(config.name);
        if (!row) throw new Error(`Repo row missing for ${config.name}`);
        const result = await this.syncRepo(config, row, options);
        this.logResult(result);
        results.push(result);
      }
      return results;
    } finally {
      await held.release();
    }
  }

  private async syncRepo(
    config: RepoConfig,
    row: RepoRow,
    options: SyncOptions,
  ): Promise<RepoSyncResult> {
    const startedAt = Date.now();
    const runId = await this.index.startRun(row.id, options.trigger, row.lastIndexedSha);
    const counts: RunCounts = {
      filesChanged: 0,
      chunksAdded: 0,
      chunksRemoved: 0,
      chunksEmbedded: 0,
    };
    let toSha: string | null = null;
    let mode: RepoSyncResult['mode'] = 'unchanged';

    try {
      const dir = join(this.env.DATA_DIR, config.name);
      toSha = await this.git.syncMirror(config.url, config.branch, dir);
      const configHash = repoConfigHash(config);
      const matcher = createFileMatcher(config.include, config.exclude);
      const stored = await this.index.documentsByPath(row.id);

      const work = await this.buildWorkList({ dir, row, toSha, configHash, matcher, stored });
      mode = work.mode;

      // New and changed files first: a moved file's old chunks must still exist so their
      // embeddings can be reused before the old document is deleted.
      for (const path of work.process) {
        await this.indexFile({
          dir,
          path,
          config,
          repoId: row.id,
          stored: stored.get(path),
          counts,
        });
      }
      for (const path of work.remove) {
        const document = stored.get(path);
        if (!document) continue;
        counts.chunksRemoved += await this.index.deleteDocument(document.id);
        counts.filesChanged += 1;
      }

      await this.index.markIndexed(row.id, toSha, configHash);
      const durationMs = Date.now() - startedAt;
      await this.index.finishRun(runId, { ...counts, status: 'success', toSha, durationMs });
      return {
        repo: config.name,
        status: 'success',
        fromSha: row.lastIndexedSha,
        toSha,
        mode,
        ...counts,
        durationMs,
      };
    } catch (error) {
      const message = (error as Error).message;
      const durationMs = Date.now() - startedAt;
      await this.index.finishRun(runId, {
        ...counts,
        status: 'failed',
        toSha,
        error: message,
        durationMs,
      });
      return {
        repo: config.name,
        status: 'failed',
        fromSha: row.lastIndexedSha,
        toSha,
        mode,
        ...counts,
        durationMs,
        error: message,
      };
    }
  }

  /**
   * Decides what to look at. A full reconcile (every matching file) happens on the first sync,
   * after repos.yaml or the parser changed, or when the last indexed commit no longer exists
   * (force-push). Otherwise only the files in `git diff last..HEAD` are considered.
   */
  private async buildWorkList(input: {
    dir: string;
    row: RepoRow;
    toSha: string;
    configHash: string;
    matcher: FileMatcher;
    stored: Map<string, StoredDocument>;
  }): Promise<WorkList> {
    const { dir, row, toSha, configHash, matcher, stored } = input;
    const indexable = (path: string) => matcher(path) && isSupportedFile(path);
    const lastSha = row.lastIndexedSha;

    const canDiff =
      lastSha !== null && row.configHash === configHash && (await this.git.hasCommit(dir, lastSha));
    if (!canDiff) {
      const files = (await this.git.listFiles(dir)).filter(indexable);
      const current = new Set(files);
      return {
        mode: 'full',
        process: files,
        remove: [...stored.keys()].filter((p) => !current.has(p)),
      };
    }

    if (lastSha === toSha) return { mode: 'unchanged', process: [], remove: [] };

    const process: string[] = [];
    const remove: string[] = [];
    for (const change of await this.git.diff(dir, lastSha, toSha)) {
      if (change.status !== 'deleted' && indexable(change.path)) process.push(change.path);
      else if (stored.has(change.path)) remove.push(change.path);
    }
    return { mode: 'incremental', process, remove };
  }

  private async indexFile(input: {
    dir: string;
    path: string;
    config: RepoConfig;
    repoId: number;
    stored: StoredDocument | undefined;
    counts: RunCounts;
  }): Promise<void> {
    const { dir, path, config, repoId, stored, counts } = input;
    const content = await readFile(join(dir, path), 'utf8');
    const processed = processDocument({
      repoName: config.name,
      path,
      content,
      codePairs: config.codePairs,
    });
    if (!processed || stored?.contentHash === processed.contentHash) return;

    const existing = stored ? await this.index.chunksOfDocument(stored.id) : [];
    const plan = planChunkChanges(existing, processed.chunks, this.embedder.model);
    const embeddings = await this.embeddingsFor(
      plan.insert.map((d) => ({ hash: d.contentHash, text: d.embeddingText })),
      counts,
    );

    await this.index.saveDocument({
      repoId,
      path,
      processed,
      plan,
      embeddings,
      model: this.embedder.model,
    });
    counts.filesChanged += 1;
    counts.chunksAdded += plan.insert.length;
    counts.chunksRemoved += plan.remove.length;
  }

  /** Reuses stored embeddings for known text and embeds the rest in one batch. */
  private async embeddingsFor(
    items: { hash: string; text: string }[],
    counts: RunCounts,
  ): Promise<Map<string, number[]>> {
    const embeddings = await this.index.reusableEmbeddings(
      items.map((i) => i.hash),
      this.embedder.model,
    );
    const missing = [
      ...new Map(items.filter((i) => !embeddings.has(i.hash)).map((i) => [i.hash, i])).values(),
    ];
    if (missing.length === 0) return embeddings;

    const vectors = await this.embedder.embedDocuments(missing.map((i) => i.text));
    missing.forEach((item, i) => {
      const vector = vectors[i];
      if (!vector) throw new Error('The embedding model returned fewer vectors than requested');
      embeddings.set(item.hash, vector);
    });
    counts.chunksEmbedded += missing.length;
    return embeddings;
  }

  private logResult(r: RepoSyncResult): void {
    const range = `${r.fromSha?.slice(0, 7) ?? '(new)'}→${r.toSha?.slice(0, 7) ?? '?'}`;
    const files = `${r.filesChanged} ${r.filesChanged === 1 ? 'file' : 'files'} changed`;
    const summary =
      `${r.repo} [${r.mode}] ${range} · ${files} · ` +
      `+${r.chunksAdded} −${r.chunksRemoved} chunks · ${r.chunksEmbedded} embedded · ${r.durationMs} ms`;
    if (r.status === 'success') this.logger.log(summary);
    else this.logger.error(`${summary} · FAILED: ${r.error ?? 'unknown error'}`);
  }
}
