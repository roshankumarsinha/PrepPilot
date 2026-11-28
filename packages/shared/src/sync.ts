import { z } from 'zod';

export const SyncTriggerSchema = z.enum(['manual', 'schedule', 'cli']);
export type SyncTrigger = z.infer<typeof SyncTriggerSchema>;

export const SyncStatusSchema = z.enum(['running', 'success', 'failed']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

/** One sync of one repo: a row of the sync log. */
export const SyncRunSchema = z.object({
  id: z.number().int(),
  repo: z.string(),
  trigger: SyncTriggerSchema,
  status: SyncStatusSchema,
  fromSha: z.string().nullable(),
  toSha: z.string().nullable(),
  filesChanged: z.number().int().nonnegative(),
  chunksAdded: z.number().int().nonnegative(),
  chunksRemoved: z.number().int().nonnegative(),
  /** Chunks sent to the embedding model; unchanged or reused text is not counted. */
  chunksEmbedded: z.number().int().nonnegative(),
  error: z.string().nullable(),
  startedAt: z.iso.datetime({ offset: true }),
  finishedAt: z.iso.datetime({ offset: true }).nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
});
export type SyncRun = z.infer<typeof SyncRunSchema>;

/** A notes repo and the state of its index. */
export const RepoSummarySchema = z.object({
  name: z.string(),
  url: z.string(),
  branch: z.string(),
  description: z.string().nullable(),
  topics: z.array(z.string()),
  lastIndexedSha: z.string().nullable(),
  lastSyncedAt: z.iso.datetime({ offset: true }).nullable(),
  documentCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
});
export type RepoSummary = z.infer<typeof RepoSummarySchema>;

/** Response of `POST /sync` and `POST /sync/:repo`: the sync runs in the background. */
export const SyncStartedSchema = z.object({
  started: z.literal(true),
  repos: z.array(z.string()),
});
export type SyncStarted = z.infer<typeof SyncStartedSchema>;
