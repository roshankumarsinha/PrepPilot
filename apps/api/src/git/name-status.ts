export type FileChangeStatus = 'added' | 'modified' | 'deleted';

export interface FileChange {
  status: FileChangeStatus;
  path: string;
}

/**
 * Parses `git diff --name-status -z -M` output. A rename becomes a delete of the old path plus
 * an add of the new one, and a copy becomes an add, so callers only handle three cases.
 */
export function parseNameStatus(output: string): FileChange[] {
  const fields = output.split('\0').filter((field) => field !== '');
  const changes: FileChange[] = [];

  for (let i = 0; i < fields.length;) {
    const code = (fields[i] ?? '').charAt(0);
    if (code === 'R' || code === 'C') {
      const from = fields[i + 1];
      const to = fields[i + 2];
      if (from === undefined || to === undefined) throw new Error('Truncated rename in git diff');
      if (code === 'R') changes.push({ status: 'deleted', path: from });
      changes.push({ status: 'added', path: to });
      i += 3;
      continue;
    }
    const path = fields[i + 1];
    if (path === undefined) throw new Error(`Missing path after "${fields[i] ?? ''}" in git diff`);
    changes.push({ status: toStatus(code), path });
    i += 2;
  }
  return changes;
}

function toStatus(code: string): FileChangeStatus {
  switch (code) {
    case 'A':
      return 'added';
    case 'D':
      return 'deleted';
    case 'M':
    case 'T':
      return 'modified';
    default:
      throw new Error(`Unexpected git status "${code}"`);
  }
}
