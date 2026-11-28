import type { Config } from 'jest';

/** End-to-end tests: boot the real app against a dedicated test database (see global-setup.ts). */
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  globalSetup: '<rootDir>/global-setup.ts',
  // The suites share one database, so they must not run at the same time.
  maxWorkers: 1,
};

export default config;
