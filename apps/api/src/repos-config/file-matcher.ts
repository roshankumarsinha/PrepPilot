import picomatch from 'picomatch';

export type FileMatcher = (path: string) => boolean;

/**
 * Builds a predicate for repo-relative paths: a file is indexed when it matches at least one
 * `include` pattern and no `exclude` pattern. Matching ignores case so `README.md` also
 * matches `Readme.md`, and dotfiles are matched like any other file.
 */
export function createFileMatcher(include: string[], exclude: string[]): FileMatcher {
  const options = { dot: true, nocase: true };
  const isIncluded = picomatch(include, options);
  const isExcluded = exclude.length > 0 ? picomatch(exclude, options) : () => false;
  return (path) => isIncluded(path) && !isExcluded(path);
}
