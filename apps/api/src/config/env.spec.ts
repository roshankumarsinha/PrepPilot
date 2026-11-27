import { parseEnv } from './env';

const DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

describe('parseEnv', () => {
  it('applies defaults for optional values', () => {
    expect(parseEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL,
    });
  });

  it('coerces PORT from a string', () => {
    expect(parseEnv({ DATABASE_URL, PORT: '4000' }).PORT).toBe(4000);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-Postgres DATABASE_URL', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => parseEnv({ DATABASE_URL, PORT: '70000' })).toThrow(/PORT/);
  });
});
