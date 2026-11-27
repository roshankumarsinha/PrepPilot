import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parses and validates environment variables. Throws one readable error listing
 * every problem, so a misconfigured app fails at startup instead of on first use.
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/**
 * Loads `.env` (from the API folder or the repo root, whichever exists) into
 * `process.env` without overriding variables that are already set, then validates.
 */
export function loadEnv(): Env {
  loadDotenv({
    path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
    quiet: true,
  });
  return parseEnv(process.env);
}
