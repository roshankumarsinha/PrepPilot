import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RepoSummarySchema, SyncRunSchema } from '@preppilot/shared';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ENV } from '../src/config/config.module';
import { loadEnv } from '../src/config/env';
import { DatabaseService } from '../src/database/database.service';
import { EMBEDDING_PROVIDER } from '../src/embeddings/embedding.provider';
import { SyncLock } from '../src/sync/sync-lock';
import { SyncService } from '../src/sync/sync.service';
import { SyncBusyError } from '../src/sync/sync.types';
import { FakeEmbeddingProvider } from './fakes';
import { GitFixture } from './git-fixture';

const REPO = 'test-notes';
const section = (title: string, word: string) => `## ${title}\n\n${`${word} `.repeat(80).trim()}\n`;
const readme = (betaWord = 'beta') =>
  `# Notes\n\n${section('Alpha', 'alpha')}\n${section('Beta', betaWord)}\n${section('Gamma', 'gamma')}`;

/**
 * The Phase 1 "Done when" check as an automated test: edit one section of one note, commit,
 * sync again, and exactly one chunk is embedded. Uses a real git repo and real Postgres, with
 * a fake embedding model.
 */
describe('Incremental sync (e2e)', () => {
  const fixture = new GitFixture();
  const embedder = new FakeEmbeddingProvider();
  let app: INestApplication<App>;
  let sync: SyncService;
  let database: DatabaseService;

  const runSync = async () => {
    const [result] = await sync.runNow({ trigger: 'cli', repo: REPO });
    if (!result) throw new Error('no sync result');
    return result;
  };

  beforeAll(async () => {
    fixture
      .write('README.md', readme())
      .write(
        'notes/event-loop.txt',
        `Event Loop\n==========\n\n${'The loop polls queues. '.repeat(20)}\n`,
      )
      .write('cpp/1_twoSum.cpp', '// Two Sum\nint main() { return 0; }\n')
      .write('js/1_twoSum.js', '// Two Sum\nfunction main() { return 0; }\n')
      .write('drafts/wip.md', '# Draft\n\nnot ready')
      .write('logo.png', 'binary');
    fixture.commit('initial notes');

    const env = {
      ...loadEnv(),
      REPOS_CONFIG: fixture.writeConfig(REPO, '    exclude: [drafts/**]\n'),
      DATA_DIR: fixture.dataDir,
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ENV)
      .useValue(env)
      .overrideProvider(EMBEDDING_PROVIDER)
      .useValue(embedder)
      .compile();
    app = moduleRef.createNestApplication();
    app.useLogger(process.env.E2E_LOGS ? ['error', 'warn', 'log'] : false);
    await app.init();

    sync = app.get(SyncService);
    database = app.get(DatabaseService);
    await database.db.execute(sql`truncate table repos restart identity cascade`);
  });

  afterAll(async () => {
    await app.close();
    fixture.cleanup();
  });

  it('indexes every matching file on the first sync', async () => {
    const result = await runSync();

    expect(result).toMatchObject({
      status: 'success',
      mode: 'full',
      fromSha: null,
      filesChanged: 4,
    });
    expect(result.chunksEmbedded).toBe(result.chunksAdded);
    expect(result.chunksAdded).toBeGreaterThanOrEqual(6);

    const paths = await database.db.execute<{ path: string }>(sql`select path from documents`);
    expect(paths.rows.map((r) => r.path).sort()).toEqual([
      'README.md',
      'cpp/1_twoSum.cpp',
      'js/1_twoSum.js',
      'notes/event-loop.txt',
    ]);
  });

  it('links the C++ and JS versions of a problem', async () => {
    const keys = await database.db.execute<{ problem_key: string }>(
      sql`select distinct problem_key from documents where problem_key is not null`,
    );
    expect(keys.rows).toEqual([{ problem_key: '1' }]);
  });

  it('does nothing when there are no new commits', async () => {
    const result = await runSync();
    expect(result).toMatchObject({ mode: 'unchanged', filesChanged: 0, chunksEmbedded: 0 });
  });

  it('re-embeds exactly one chunk when one section of one note changes (Phase 1 "Done when")', async () => {
    const before = embedder.embedded.length;
    fixture.write('README.md', readme('edited'));
    fixture.commit('edit the Beta section');

    const result = await runSync();

    expect(result).toMatchObject({
      status: 'success',
      mode: 'incremental',
      filesChanged: 1,
      chunksAdded: 1,
      chunksRemoved: 1,
      chunksEmbedded: 1,
    });
    expect(embedder.embedded.slice(before)).toEqual([expect.stringContaining('Notes > Beta')]);
  });

  it('reuses embeddings when a file moves to another folder', async () => {
    // Same file name, so the same title and heading paths: nothing needs embedding again.
    fixture.git('mv', 'notes', 'node');
    fixture.commit('move notes/ to node/');

    const result = await runSync();

    expect(result).toMatchObject({ mode: 'incremental', filesChanged: 2, chunksEmbedded: 0 });
    expect(result.chunksAdded).toBe(result.chunksRemoved);
  });

  it('removes the chunks of a deleted file', async () => {
    fixture.git('rm', '-q', 'js/1_twoSum.js');
    fixture.commit('delete js');

    const result = await runSync();

    expect(result).toMatchObject({
      mode: 'incremental',
      filesChanged: 1,
      chunksAdded: 0,
      chunksEmbedded: 0,
    });
    expect(result.chunksRemoved).toBeGreaterThan(0);
  });

  it('re-checks every file after the include rules change', async () => {
    const env = app.get<{ REPOS_CONFIG: string }>(ENV);
    fixture.writeConfig(REPO); // drafts/ is no longer excluded
    expect(env.REPOS_CONFIG).toContain('repos.yaml');

    const result = await runSync();

    expect(result).toMatchObject({ mode: 'full', filesChanged: 1, chunksEmbedded: 1 });
  });

  it('refuses to start while another sync holds the lock', async () => {
    const held = await app.get(SyncLock).tryAcquire();
    try {
      await expect(sync.runNow({ trigger: 'cli' })).rejects.toBeInstanceOf(SyncBusyError);
      await request(app.getHttpServer()).post('/sync').expect(409);
    } finally {
      await held?.release();
    }
  });

  it('serves the sync log and repo summaries', async () => {
    const runs = await request(app.getHttpServer()).get('/sync/runs?limit=3').expect(200);
    const parsedRuns = SyncRunSchema.array().parse(runs.body);
    expect(parsedRuns).toHaveLength(3);
    expect(parsedRuns.every((r) => r.repo === REPO && r.status === 'success')).toBe(true);

    const repos = await request(app.getHttpServer()).get('/repos').expect(200);
    const [repo] = RepoSummarySchema.array().parse(repos.body);
    expect(repo).toMatchObject({
      name: REPO,
      documentCount: 4,
      lastIndexedSha: fixture.git('rev-parse', 'HEAD').trim(),
    });
  });

  it('answers 404 for a repo that is not configured and 400 for a bad limit', async () => {
    await request(app.getHttpServer()).post('/sync/nope').expect(404);
    await request(app.getHttpServer()).get('/sync/runs?limit=0').expect(400);
  });
});
