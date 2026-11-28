import type { Env } from '../config/env';

/** A complete, valid Env for unit tests; override only what a test cares about. */
export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    OLLAMA_URL: 'http://localhost:11434',
    EMBED_MODEL: 'nomic-embed-text',
    REPOS_CONFIG: '/tmp/preppilot/repos.yaml',
    DATA_DIR: '/tmp/preppilot/data/repos',
    SYNC_SCHEDULE_ENABLED: false,
    SYNC_CRON: '*/15 * * * *',
    ...overrides,
  };
}
