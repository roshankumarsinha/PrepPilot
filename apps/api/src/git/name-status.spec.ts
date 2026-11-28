import { parseNameStatus } from './name-status';

describe('parseNameStatus', () => {
  it('parses adds, modifications and deletes', () => {
    expect(parseNameStatus('A\0new.md\0M\0README.md\0D\0old.md\0')).toEqual([
      { status: 'added', path: 'new.md' },
      { status: 'modified', path: 'README.md' },
      { status: 'deleted', path: 'old.md' },
    ]);
  });

  it('splits a rename into a delete and an add, keeping spaces in paths', () => {
    expect(parseNameStatus('R087\0Notes/a b.md\0Notes/c d.md\0')).toEqual([
      { status: 'deleted', path: 'Notes/a b.md' },
      { status: 'added', path: 'Notes/c d.md' },
    ]);
  });

  it('treats a copy as an add and a type change as a modification', () => {
    expect(parseNameStatus('C100\0a.md\0b.md\0T\0link.md\0')).toEqual([
      { status: 'added', path: 'b.md' },
      { status: 'modified', path: 'link.md' },
    ]);
  });

  it('returns nothing for an empty diff', () => {
    expect(parseNameStatus('')).toEqual([]);
  });

  it('rejects an unknown status instead of guessing', () => {
    expect(() => parseNameStatus('X\0a.md\0')).toThrow(/Unexpected git status "X"/);
  });
});
