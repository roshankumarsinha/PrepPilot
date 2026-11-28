import { parseEnv } from './env';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
const ROOT = '/work/preppilot';

describe('parseEnv', () => {
  it('applies defaults and resolves paths against the project root', () => {
    expect(parseEnv({ DATABASE_URL }, ROOT)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
      OLLAMA_URL: 'http://localhost:11434',
      EMBED_MODEL: 'nomic-embed-text',
      REPOS_CONFIG: '/work/preppilot/repos.yaml',
      DATA_DIR: '/work/preppilot/data/repos',
      SYNC_SCHEDULE_ENABLED: true,
      SYNC_CRON: '*/15 * * * *',
    });
  });

  it('keeps absolute paths as they are', () => {
    expect(parseEnv({ DATABASE_URL, DATA_DIR: '/tmp/repos' }, ROOT).DATA_DIR).toBe('/tmp/repos');
  });

  it('coerces PORT and SYNC_SCHEDULE_ENABLED from strings', () => {
    const env = parseEnv({ DATABASE_URL, PORT: '4000', SYNC_SCHEDULE_ENABLED: 'false' }, ROOT);
    expect(env.PORT).toBe(4000);
    expect(env.SYNC_SCHEDULE_ENABLED).toBe(false);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({}, ROOT)).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-Postgres DATABASE_URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://localhost/db' }, ROOT)).toThrow(/DATABASE_URL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => parseEnv({ DATABASE_URL, PORT: '70000' }, ROOT)).toThrow(/PORT/);
  });

  it('rejects an OLLAMA_URL that is not http(s)', () => {
    expect(() => parseEnv({ DATABASE_URL, OLLAMA_URL: 'ftp://x' }, ROOT)).toThrow(/OLLAMA_URL/);
  });
});
