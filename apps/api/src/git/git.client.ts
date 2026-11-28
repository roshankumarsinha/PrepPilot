import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { parseNameStatus, type FileChange } from './name-status';

const run = promisify(execFile);
const GIT_TIMEOUT_MS = 5 * 60_000;

/** Thin wrapper around the git CLI for the read-only clones in `data/repos`. */
@Injectable()
export class GitClient {
  /**
   * Makes `dir` an exact copy of `branch` on `url`: clones it the first time, then fetches and
   * force-checks-out the remote branch. The folder is owned by PrepPilot, so local changes
   * there are discarded. Returns the commit now checked out.
   */
  async syncMirror(url: string, branch: string, dir: string): Promise<string> {
    if (!existsSync(join(dir, '.git'))) {
      await mkdir(dirname(dir), { recursive: true });
      await this.git(null, ['clone', '--no-tags', '--branch', branch, url, dir]);
    } else {
      await this.git(dir, ['remote', 'set-url', 'origin', url]);
      await this.git(dir, [
        'fetch',
        '--no-tags',
        '--prune',
        'origin',
        `+refs/heads/${branch}:refs/remotes/origin/${branch}`,
      ]);
      await this.git(dir, ['checkout', '--force', '-B', branch, `origin/${branch}`]);
    }
    return this.headSha(dir);
  }

  async headSha(dir: string): Promise<string> {
    return (await this.git(dir, ['rev-parse', 'HEAD'])).trim();
  }

  /** Whether `sha` is a commit in this clone (it may be gone after a force-push). */
  async hasCommit(dir: string, sha: string): Promise<boolean> {
    try {
      await this.git(dir, ['cat-file', '-e', `${sha}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  }

  /** Every tracked file at HEAD, relative to the repo root. */
  async listFiles(dir: string): Promise<string[]> {
    const output = await this.git(dir, ['ls-files', '-z']);
    return output.split('\0').filter(Boolean);
  }

  /** Files added, modified and deleted between two commits (renames split into delete + add). */
  async diff(dir: string, from: string, to: string): Promise<FileChange[]> {
    const output = await this.git(dir, ['diff', '--name-status', '-z', '-M', from, to]);
    return parseNameStatus(output);
  }

  private async git(dir: string | null, args: string[]): Promise<string> {
    const fullArgs = dir === null ? args : ['-C', dir, ...args];
    try {
      const { stdout } = await run('git', fullArgs, {
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: 64 * 1024 * 1024,
        // Never block on a credential prompt; fail fast instead.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
      });
      return stdout;
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr?.trim();
      const reason = stderr !== undefined && stderr !== '' ? stderr : (error as Error).message;
      throw new Error(`git ${args[0] ?? ''} failed: ${reason}`, { cause: error });
    }
  }
}
