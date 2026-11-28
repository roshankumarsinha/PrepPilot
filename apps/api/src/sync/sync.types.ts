import type { SyncTrigger } from '@preppilot/shared';

export interface SyncOptions {
  trigger: SyncTrigger;
  /** Sync only this repo; all repos when omitted. */
  repo?: string;
}

export interface RepoSyncResult {
  repo: string;
  status: 'success' | 'failed';
  fromSha: string | null;
  toSha: string | null;
  /** `full` re-checks every file; `incremental` follows `git diff`; `unchanged` had no new commits. */
  mode: 'full' | 'incremental' | 'unchanged';
  filesChanged: number;
  chunksAdded: number;
  chunksRemoved: number;
  chunksEmbedded: number;
  durationMs: number;
  error?: string;
}

/** Thrown when a sync is requested while another one is running. */
export class SyncBusyError extends Error {
  override readonly name = 'SyncBusyError';
  constructor() {
    super('A sync is already running');
  }
}

/** Thrown when a requested repo is not in repos.yaml. */
export class UnknownRepoError extends Error {
  override readonly name = 'UnknownRepoError';
  constructor(readonly repo: string) {
    super(`Repo "${repo}" is not in repos.yaml`);
  }
}
