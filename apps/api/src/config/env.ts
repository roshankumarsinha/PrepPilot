import { isAbsolute, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { findProjectRoot } from '../common/project-root';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  OLLAMA_URL: z.url({ protocol: /^https?$/ }).default('http://localhost:11434'),
  EMBED_MODEL: z.string().min(1).default('nomic-embed-text'),

  /** Paths are relative to the monorepo root unless absolute. */
  REPOS_CONFIG: z.string().min(1).default('repos.yaml'),
  DATA_DIR: z.string().min(1).default('data/repos'),

  SYNC_SCHEDULE_ENABLED: z.stringbool().default(true),
  /** Cron expression for the automatic sync; every 15 minutes by default. */
  SYNC_CRON: z.string().min(1).default('*/15 * * * *'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parses and validates environment variables. Throws one readable error listing
 * every problem, so a misconfigured app fails at startup instead of on first use.
 * Relative paths are resolved against `projectRoot`.
 */
export function parseEnv(source: NodeJS.ProcessEnv, projectRoot = findProjectRoot()): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  const env = result.data;
  const toAbsolute = (path: string) => (isAbsolute(path) ? path : resolve(projectRoot, path));
  return { ...env, REPOS_CONFIG: toAbsolute(env.REPOS_CONFIG), DATA_DIR: toAbsolute(env.DATA_DIR) };
}

/**
 * Loads the repo-root `.env` into `process.env` without overriding variables that are
 * already set, then validates.
 */
export function loadEnv(): Env {
  const root = findProjectRoot();
  loadDotenv({ path: resolve(root, '.env'), quiet: true });
  return parseEnv(process.env, root);
}
