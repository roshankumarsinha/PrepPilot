import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** A throwaway git repository that plays the role of a notes repo on GitHub. */
export class GitFixture {
  readonly root = mkdtempSync(join(tmpdir(), 'preppilot-e2e-'));
  readonly origin = join(this.root, 'origin');
  readonly dataDir = join(this.root, 'data');

  constructor() {
    mkdirSync(this.origin);
    this.git('init', '--initial-branch=main');
    this.git('config', 'user.email', 'test@example.com');
    this.git('config', 'user.name', 'Test');
    this.git('config', 'commit.gpgsign', 'false');
  }

  write(path: string, content: string): this {
    const full = join(this.origin, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
    return this;
  }

  commit(message: string): string {
    this.git('add', '-A');
    this.git('commit', '-m', message);
    return this.git('rev-parse', 'HEAD').trim();
  }

  git(...args: string[]): string {
    return execFileSync('git', ['-C', this.origin, ...args], { encoding: 'utf8' });
  }

  /** Writes a repos.yaml pointing at this fixture and returns its path. */
  writeConfig(name: string, extra = ''): string {
    const path = join(this.root, 'repos.yaml');
    writeFileSync(
      path,
      `repos:\n  - name: ${name}\n    url: ${this.origin}\n    branch: main\n    codePairs: [cpp, js]\n${extra}`,
    );
    return path;
  }

  cleanup(): void {
    rmSync(this.root, { recursive: true, force: true });
  }
}
