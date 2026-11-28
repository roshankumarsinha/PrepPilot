import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';

/** nomic-embed-text produces 768-dimensional vectors. */
export const EMBEDDING_DIMENSIONS = 768;

export const documentKind = pgEnum('document_kind', ['markdown', 'text', 'code']);
export const linkKind = pgEnum('link_kind', ['chatgpt', 'youtube', 'article', 'other']);
export const syncTrigger = pgEnum('sync_trigger', ['manual', 'schedule', 'cli']);
export const syncStatus = pgEnum('sync_status', ['running', 'success', 'failed']);

/** One row per notes repo in repos.yaml. */
export const repos = pgTable('repos', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  url: text('url').notNull(),
  branch: text('branch').notNull(),
  description: text('description'),
  topics: text('topics')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  /** Commit the index reflects; the next sync diffs from here. */
  lastIndexedSha: text('last_indexed_sha'),
  /** Hash of this repo's include/exclude rules and the parser version; a change forces a full reconcile. */
  configHash: text('config_hash'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** One row per indexed file. */
export const documents = pgTable(
  'documents',
  {
    id: serial('id').primaryKey(),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    kind: documentKind('kind').notNull(),
    title: text('title').notNull(),
    /** Hash of the file content plus parser version; unchanged files are skipped. */
    contentHash: text('content_hash').notNull(),
    /** Links the C++ and JS versions of the same problem (see `codePairs` in repos.yaml). */
    problemKey: text('problem_key'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('documents_repo_path_idx').on(t.repoId, t.path),
    index('documents_problem_key_idx').on(t.problemKey),
  ],
);

/** A searchable piece of a document. Only new `content_hash` values are embedded. */
export const chunks = pgTable(
  'chunks',
  {
    id: serial('id').primaryKey(),
    documentId: integer('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    /** Position of the chunk within its document. */
    ordinal: integer('ordinal').notNull(),
    headingPath: text('heading_path').array().notNull(),
    content: text('content').notNull(),
    contentHash: text('content_hash').notNull(),
    startLine: integer('start_line').notNull(),
    endLine: integer('end_line').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    embedModel: text('embed_model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('chunks_document_idx').on(t.documentId),
    index('chunks_content_hash_idx').on(t.contentHash),
  ],
);

/** External links found in a chunk (ChatGPT shares, YouTube videos, articles). */
export const links = pgTable(
  'links',
  {
    id: serial('id').primaryKey(),
    chunkId: integer('chunk_id')
      .notNull()
      .references(() => chunks.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    kind: linkKind('kind').notNull(),
    label: text('label'),
  },
  (t) => [index('links_chunk_idx').on(t.chunkId), index('links_url_idx').on(t.url)],
);

/** One row per repo per sync; the sync log shown on the Repos page. */
export const syncRuns = pgTable(
  'sync_runs',
  {
    id: serial('id').primaryKey(),
    repoId: integer('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    trigger: syncTrigger('trigger').notNull(),
    status: syncStatus('status').notNull().default('running'),
    fromSha: text('from_sha'),
    toSha: text('to_sha'),
    filesChanged: integer('files_changed').notNull().default(0),
    chunksAdded: integer('chunks_added').notNull().default(0),
    chunksRemoved: integer('chunks_removed').notNull().default(0),
    /** Chunks actually sent to the embedding model (excludes reused embeddings). */
    chunksEmbedded: integer('chunks_embedded').notNull().default(0),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
  },
  (t) => [index('sync_runs_repo_started_idx').on(t.repoId, t.startedAt)],
);

export type RepoRow = typeof repos.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ChunkRow = typeof chunks.$inferSelect;
export type SyncRunRow = typeof syncRuns.$inferSelect;
