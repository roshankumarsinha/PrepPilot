import { documentTitle, isSupportedFile, processDocument } from '../parse-document';

describe('documentTitle', () => {
  it.each([
    ['Accessibility/README.md', 'Accessibility'],
    ['Backend System Design/Readme.md', 'Backend System Design'],
    ['offline/README1.md', 'offline'],
    ['README.md', 'AI-Notes'],
    ['Interview.md', 'Interview'],
    ['impQuestionOnNodejs.txt', 'Imp Question On Nodejs'],
  ])('%s -> %s', (path, title) => {
    expect(documentTitle('AI-Notes', path)).toBe(title);
  });
});

describe('processDocument', () => {
  it('skips file types that are not indexed', () => {
    expect(isSupportedFile('logo.png')).toBe(false);
    expect(
      processDocument({ repoName: 'r', path: '.gitignore', content: 'x', codePairs: [] }),
    ).toBeNull();
  });

  it('gives the same file the same content hash, and a different one when it changes', () => {
    const input = { repoName: 'r', path: 'a.md', content: '# A\n\ntext', codePairs: [] };
    expect(processDocument(input)?.contentHash).toBe(processDocument(input)?.contentHash);
    expect(processDocument({ ...input, content: '# A\n\nedited' })?.contentHash).not.toBe(
      processDocument(input)?.contentHash,
    );
  });
});
