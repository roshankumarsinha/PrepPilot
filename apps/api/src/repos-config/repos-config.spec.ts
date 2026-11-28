import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from '../common/project-root';
import { createFileMatcher } from './file-matcher';
import { parseReposConfig, repoConfigHash, ReposConfigError } from './repos-config.loader';

const minimal = `
repos:
  - name: Notes
    url: https://github.com/example/notes.git
`;

describe('parseReposConfig', () => {
  it('applies defaults to a minimal entry', () => {
    expect(parseReposConfig(minimal)).toEqual([
      {
        name: 'Notes',
        url: 'https://github.com/example/notes.git',
        branch: 'main',
        description: null,
        topics: [],
        include: ['**'],
        exclude: [],
        codePairs: [],
      },
    ]);
  });

  it('prepends default excludes and uses the default branch', () => {
    const [repo] = parseReposConfig(`
defaults:
  branch: master
  exclude: ['**/node_modules/**']
repos:
  - name: Notes
    url: x
    exclude: [drafts/**]
`);
    expect(repo?.branch).toBe('master');
    expect(repo?.exclude).toEqual(['**/node_modules/**', 'drafts/**']);
  });

  it('rejects duplicate names regardless of case', () => {
    const yaml = `repos:\n  - { name: Notes, url: a }\n  - { name: notes, url: b }`;
    expect(() => parseReposConfig(yaml)).toThrow(/duplicate repo name "notes"/);
  });

  it('rejects a name that is not safe as a folder name', () => {
    expect(() => parseReposConfig(`repos:\n  - { name: ../evil, url: a }`)).toThrow(
      ReposConfigError,
    );
  });

  it('rejects invalid YAML with a readable error', () => {
    expect(() => parseReposConfig('repos: [', 'repos.yaml')).toThrow(
      /repos.yaml is not valid YAML/,
    );
  });

  it('rejects an empty repo list', () => {
    expect(() => parseReposConfig('repos: []')).toThrow(/repos/);
  });
});

describe('repoConfigHash', () => {
  const [repo] = parseReposConfig(minimal);
  if (!repo) throw new Error('fixture missing');

  it('changes when the include rules change', () => {
    expect(repoConfigHash({ ...repo, include: ['docs/**'] })).not.toBe(repoConfigHash(repo));
  });

  it('ignores fields that do not affect indexing', () => {
    expect(repoConfigHash({ ...repo, description: 'new text' })).toBe(repoConfigHash(repo));
  });
});

describe('createFileMatcher', () => {
  it('matches README names in any case', () => {
    const matches = createFileMatcher(['Docs/README.md'], []);
    expect(matches('Docs/Readme.md')).toBe(true);
    expect(matches('Docs/notes.md')).toBe(false);
  });

  it('lets exclude win over include', () => {
    const matches = createFileMatcher(['**'], ['drafts/**']);
    expect(matches('a.md')).toBe(true);
    expect(matches('drafts/a.md')).toBe(false);
  });
});

/**
 * Guards the real rules in repos.yaml against the real file list of the largest repo, so a
 * typo in a glob shows up as a failing test instead of silently missing notes.
 */
describe('repos.yaml rules for namaste-frontend-system-design', () => {
  const root = findProjectRoot(__dirname);
  const repos = parseReposConfig(readFileSync(join(root, 'repos.yaml'), 'utf8'));
  const repo = repos.find((r) => r.name === 'namaste-frontend-system-design');
  if (!repo) throw new Error('repo missing from repos.yaml');
  const files = readFileSync(
    join(__dirname, '__fixtures__/namaste-frontend-system-design.files.txt'),
    'utf8',
  )
    .split('\n')
    .filter(Boolean);
  const matches = createFileMatcher(repo.include, repo.exclude);
  const indexed = files.filter(matches).sort();

  it('indexes exactly the agreed READMEs', () => {
    expect(indexed).toEqual(
      [
        'Accessibility/README.md',
        'Backend System Design/Readme.md',
        'CommunicationTechniques/README.md',
        'Databases&Caching/API Caching/README.md',
        'Databases&Caching/Database & Caching Overview/README.md',
        'Databases&Caching/cookieStorage/README.md',
        'Databases&Caching/httpCaching/README.md',
        'Databases&Caching/indexedDb/README.md',
        'Databases&Caching/localStorage/README.md',
        'Databases&Caching/serviceWorker/README.md',
        'Databases&Caching/sessionStorage/README.md',
        'Design Patterns/Readme.md',
        'LLD/app/README.md',
        'Networking/Communication Protocols/README.md',
        'Networking/How Web Works/README.md',
        'Networking/README.md',
        'Networking/RestApi/README.md',
        'Performance/Build Optimization/README.md',
        'Performance/Network Optimization/README.md',
        'Performance/Performace Monitoring/README.md',
        'Performance/README.md',
        'Performance/RenderingPatterns/README.md',
        'Security/CORS/README.md',
        'Security/Client Side Security/README.md',
        'Security/Dependency Security/README.md',
        'Security/IframeProtection/README.md',
        'Security/Input Validation and Sanitization/README.md',
        'Security/README.md',
        'Security/XSS/README.md',
        'offline/README.md',
        'offline/README1.md',
      ].sort(),
    );
  });

  it('never indexes HLD, testing or the top-level README', () => {
    expect(indexed.filter((f) => /^(HLD|testing)\//.test(f) || f === 'README.md')).toEqual([]);
  });
});
