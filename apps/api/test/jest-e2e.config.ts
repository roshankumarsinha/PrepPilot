import type { Config } from 'jest';

/** End-to-end tests: boot the real app against the Postgres from docker-compose. */
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
};

export default config;
