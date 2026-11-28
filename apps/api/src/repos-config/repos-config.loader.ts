import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { PARSER_VERSION } from '../ingestion/parser-version';
import { ReposFileSchema, type RepoConfig } from './repos-config.schema';

/** Thrown when repos.yaml is missing, is not valid YAML, or does not match the schema. */
export class ReposConfigError extends Error {
  override readonly name = 'ReposConfigError';
}

/** Parses repos.yaml text and applies defaults. Pure, so it is easy to test. */
export function parseReposConfig(yamlText: string, source = 'repos.yaml'): RepoConfig[] {
  let raw: unknown;
  try {
    raw = parseYaml(yamlText);
  } catch (error) {
    throw new ReposConfigError(`${source} is not valid YAML: ${(error as Error).message}`);
  }

  const result = ReposFileSchema.safeParse(raw);
  if (!result.success) {
    throw new ReposConfigError(`${source} is invalid:\n${z.prettifyError(result.error)}`);
  }

  const { defaults, repos } = result.data;
  return repos.map((repo) => ({
    name: repo.name,
    url: repo.url,
    branch: repo.branch ?? defaults.branch,
    description: repo.description ?? null,
    topics: repo.topics,
    include: repo.include,
    exclude: [...defaults.exclude, ...repo.exclude],
    codePairs: repo.codePairs,
  }));
}

export async function loadReposConfig(path: string): Promise<RepoConfig[]> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    throw new ReposConfigError(`Cannot read repos config at ${path}`);
  }
  return parseReposConfig(text, path);
}

/**
 * Fingerprint of everything that decides which files are indexed and how they are chunked.
 * When it changes, the next sync re-checks every file instead of trusting `git diff`.
 */
export function repoConfigHash(repo: RepoConfig): string {
  const relevant = {
    parserVersion: PARSER_VERSION,
    include: repo.include,
    exclude: repo.exclude,
    codePairs: repo.codePairs,
  };
  return createHash('sha256').update(JSON.stringify(relevant)).digest('hex');
}
