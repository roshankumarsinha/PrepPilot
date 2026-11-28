import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Finds the monorepo root (the folder holding `pnpm-workspace.yaml`) by walking up from
 * `start`. Paths such as `repos.yaml` and `data/repos` are resolved against it, so they work
 * whether the API is started from the repo root or from `apps/api`.
 */
export function findProjectRoot(start: string = process.cwd()): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}
