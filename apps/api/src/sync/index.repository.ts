import { Injectable } from '@nestjs/common';
import type { RepoSummary, SyncRun, SyncTrigger } from '@preppilot/shared';
import { and, count, countDistinct, desc, eq, inArray, isNotNull, notInArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { chunks, documents, links, repos, syncRuns, type RepoRow } from '../database/schema';
import type { ProcessedDocument } from '../ingestion/parse-document';
import type { RepoConfig } from '../repos-config/repos-config.schema';
import type { ChunkPlan, StoredChunk } from './chunk-plan';

export interface StoredDocument {
  id: number;
  contentHash: string;
}

export interface RunCounts {
  filesChanged: number;
  chunksAdded: number;
  chunksRemoved: number;
  chunksEmbedded: number;
}

/** All database reads and writes the sync needs, so the sync logic stays free of SQL. */
@Injectable()
export class IndexRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  /** Inserts or updates repos from repos.yaml and returns their rows by name. */
  async upsertRepos(configs: RepoConfig[]): Promise<Map<string, RepoRow>> {
    const rows = new Map<string, RepoRow>();
    for (const config of configs) {
      const values = {
        name: config.name,
        url: config.url,
        branch: config.branch,
        description: config.description,
        topics: config.topics,
      };
      const [row] = await this.db
        .insert(repos)
        .values(values)
        .onConflictDoUpdate({ target: repos.name, set: values })
        .returning();
      if (row) rows.set(row.name, row);
    }
    return rows;
  }

  /** Removes repos that are no longer in repos.yaml, with all their documents and chunks. */
  async deleteReposExcept(names: string[]): Promise<string[]> {
    const removed = await this.db
      .delete(repos)
      .where(names.length > 0 ? notInArray(repos.name, names) : undefined)
      .returning({ name: repos.name });
    return removed.map((r) => r.name);
  }

  async startRun(repoId: number, trigger: SyncTrigger, fromSha: string | null): Promise<number> {
    const [run] = await this.db
      .insert(syncRuns)
      .values({ repoId, trigger, fromSha })
      .returning({ id: syncRuns.id });
    if (!run) throw new Error('Could not record the sync run');
    return run.id;
  }

  async finishRun(
    runId: number,
    result: RunCounts & {
      status: 'success' | 'failed';
      toSha: string | null;
      error?: string;
      durationMs: number;
    },
  ): Promise<void> {
    await this.db
      .update(syncRuns)
      .set({ ...result, error: result.error ?? null, finishedAt: new Date() })
      .where(eq(syncRuns.id, runId));
  }

  /** Records that the index now reflects `sha` under the given rules. */
  async markIndexed(repoId: number, sha: string, configHash: string): Promise<void> {
    await this.db
      .update(repos)
      .set({ lastIndexedSha: sha, configHash, lastSyncedAt: new Date() })
      .where(eq(repos.id, repoId));
  }

  async markChecked(repoId: number): Promise<void> {
    await this.db.update(repos).set({ lastSyncedAt: new Date() }).where(eq(repos.id, repoId));
  }

  async documentsByPath(repoId: number): Promise<Map<string, StoredDocument>> {
    const rows = await this.db
      .select({ id: documents.id, path: documents.path, contentHash: documents.contentHash })
      .from(documents)
      .where(eq(documents.repoId, repoId));
    return new Map(rows.map((r) => [r.path, { id: r.id, contentHash: r.contentHash }]));
  }

  async chunksOfDocument(documentId: number): Promise<StoredChunk[]> {
    return this.db
      .select({ id: chunks.id, contentHash: chunks.contentHash, embedModel: chunks.embedModel })
      .from(chunks)
      .where(eq(chunks.documentId, documentId));
  }

  /** Embeddings already computed for identical text anywhere in the index (e.g. a renamed file). */
  async reusableEmbeddings(hashes: string[], model: string): Promise<Map<string, number[]>> {
    if (hashes.length === 0) return new Map();
    const rows = await this.db
      .selectDistinctOn([chunks.contentHash], {
        hash: chunks.contentHash,
        embedding: chunks.embedding,
      })
      .from(chunks)
      .where(
        and(
          inArray(chunks.contentHash, hashes),
          eq(chunks.embedModel, model),
          isNotNull(chunks.embedding),
        ),
      );
    return new Map(rows.flatMap((r) => (r.embedding ? [[r.hash, r.embedding] as const] : [])));
  }

  /**
   * Writes one file's new state in a single transaction: the document row, removed chunks,
   * updated positions of unchanged chunks, and new chunks with their links and embeddings.
   */
  async saveDocument(input: {
    repoId: number;
    path: string;
    processed: ProcessedDocument;
    plan: ChunkPlan;
    embeddings: Map<string, number[]>;
    model: string;
  }): Promise<void> {
    const { repoId, path, processed, plan, embeddings, model } = input;
    await this.db.transaction(async (tx) => {
      const documentValues = {
        repoId,
        path,
        kind: processed.kind,
        title: processed.title,
        contentHash: processed.contentHash,
        problemKey: processed.problemKey,
        updatedAt: new Date(),
      };
      const [document] = await tx
        .insert(documents)
        .values(documentValues)
        .onConflictDoUpdate({ target: [documents.repoId, documents.path], set: documentValues })
        .returning({ id: documents.id });
      if (!document) throw new Error(`Could not save document ${path}`);

      if (plan.remove.length > 0) await tx.delete(chunks).where(inArray(chunks.id, plan.remove));

      for (const { id, draft } of plan.keep) {
        await tx
          .update(chunks)
          .set({ ordinal: draft.ordinal, startLine: draft.startLine, endLine: draft.endLine })
          .where(eq(chunks.id, id));
      }

      for (const draft of plan.insert) {
        const embedding = embeddings.get(draft.contentHash);
        if (!embedding) throw new Error(`Missing embedding for a chunk of ${path}`);
        const [chunk] = await tx
          .insert(chunks)
          .values({
            documentId: document.id,
            ordinal: draft.ordinal,
            headingPath: draft.headingPath,
            content: draft.content,
            contentHash: draft.contentHash,
            startLine: draft.startLine,
            endLine: draft.endLine,
            embedding,
            embedModel: model,
          })
          .returning({ id: chunks.id });
        if (chunk && draft.links.length > 0) {
          await tx
            .insert(links)
            .values(draft.links.map((link) => ({ chunkId: chunk.id, ...link })));
        }
      }
    });
  }

  /** Deletes a document and its chunks; returns how many chunks were removed. */
  async deleteDocument(documentId: number): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(chunks)
      .where(eq(chunks.documentId, documentId));
    await this.db.delete(documents).where(eq(documents.id, documentId));
    return row?.value ?? 0;
  }

  async listRepos(): Promise<RepoSummary[]> {
    const rows = await this.db
      .select({
        name: repos.name,
        url: repos.url,
        branch: repos.branch,
        description: repos.description,
        topics: repos.topics,
        lastIndexedSha: repos.lastIndexedSha,
        lastSyncedAt: repos.lastSyncedAt,
        documentCount: countDistinct(documents.id),
        chunkCount: count(chunks.id),
      })
      .from(repos)
      .leftJoin(documents, eq(documents.repoId, repos.id))
      .leftJoin(chunks, eq(chunks.documentId, documents.id))
      .groupBy(repos.id)
      .orderBy(repos.name);
    return rows.map((r) => ({ ...r, lastSyncedAt: r.lastSyncedAt?.toISOString() ?? null }));
  }

  async listRuns(options: { limit: number; repo?: string }): Promise<SyncRun[]> {
    const rows = await this.db
      .select({ run: syncRuns, repo: repos.name })
      .from(syncRuns)
      .innerJoin(repos, eq(syncRuns.repoId, repos.id))
      .where(options.repo ? eq(repos.name, options.repo) : undefined)
      .orderBy(desc(syncRuns.startedAt), desc(syncRuns.id))
      .limit(options.limit);
    return rows.map(({ run, repo }) => ({
      id: run.id,
      repo,
      trigger: run.trigger,
      status: run.status,
      fromSha: run.fromSha,
      toSha: run.toSha,
      filesChanged: run.filesChanged,
      chunksAdded: run.chunksAdded,
      chunksRemoved: run.chunksRemoved,
      chunksEmbedded: run.chunksEmbedded,
      error: run.error,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
    }));
  }
}
