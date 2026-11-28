import { describe, expect, it } from 'vitest';
import { RepoSummarySchema, SyncRunSchema } from './sync.js';

describe('SyncRunSchema', () => {
  const run = {
    id: 1,
    repo: 'Some-Important-Concepts',
    trigger: 'cli',
    status: 'success',
    fromSha: 'a1',
    toSha: 'b2',
    filesChanged: 1,
    chunksAdded: 1,
    chunksRemoved: 1,
    chunksEmbedded: 1,
    error: null,
    startedAt: '2026-11-28T10:00:00.000+00:00',
    finishedAt: '2026-11-28T10:00:01.000Z',
    durationMs: 1000,
  };

  it('accepts a finished run', () => {
    expect(SyncRunSchema.parse(run)).toEqual(run);
  });

  it('accepts a first run with no previous commit', () => {
    expect(SyncRunSchema.safeParse({ ...run, fromSha: null }).success).toBe(true);
  });

  it('rejects negative counts', () => {
    expect(SyncRunSchema.safeParse({ ...run, chunksEmbedded: -1 }).success).toBe(false);
  });
});

describe('RepoSummarySchema', () => {
  it('accepts a repo that has never been synced', () => {
    const repo = {
      name: 'DSA',
      url: 'https://github.com/x/DSA.git',
      branch: 'master',
      description: null,
      topics: ['dsa'],
      lastIndexedSha: null,
      lastSyncedAt: null,
      documentCount: 0,
      chunkCount: 0,
    };
    expect(RepoSummarySchema.parse(repo)).toEqual(repo);
  });
});
