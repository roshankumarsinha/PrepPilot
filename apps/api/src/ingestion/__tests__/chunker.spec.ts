import { chunkDocument, hashChunk, MIN_SECTION_CHARS } from '../chunker';
import { MARKDOWN_MAX_CHARS, parseMarkdown } from '../markdown.parser';

describe('chunkDocument', () => {
  it('merges a tiny section into its related previous section', () => {
    const text = `# Q1\n\n${'Answer text. '.repeat(30)}\n\n## Expected Output\n\nhello`;
    const chunks = chunkDocument(parseMarkdown(text, 'Notes'));
    expect('hello'.length).toBeLessThan(MIN_SECTION_CHARS);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain('## Expected Output');
    expect(chunks[0]?.headingPath).toEqual(['Notes', 'Q1']);
  });

  it('splits a long section into pieces under the cap, each repeating the heading', () => {
    const paragraphs = Array.from(
      { length: 12 },
      (_, i) => `Paragraph ${i}. ${'word '.repeat(50)}`,
    );
    const chunks = chunkDocument(parseMarkdown(`# Long\n\n${paragraphs.join('\n\n')}`, 'Long'));

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(MARKDOWN_MAX_CHARS);
      expect(chunk.headingPath).toEqual(['Long']);
    }
    expect(chunks[1]?.content.startsWith('# Long')).toBe(false);
  });

  it('changes only the edited chunk when one section is edited', () => {
    const doc = (body: string) =>
      `# A\n\n${'alpha '.repeat(80)}\n\n# B\n\n${body}\n\n# C\n\n${'gamma '.repeat(80)}`;
    const before = chunkDocument(parseMarkdown(doc('beta '.repeat(80)), 'Doc'));
    const after = chunkDocument(parseMarkdown(doc(`${'beta '.repeat(80)} edited`), 'Doc'));

    const changed = after.filter((c) => !before.some((b) => b.contentHash === c.contentHash));
    expect(changed.map((c) => c.headingPath.at(-1))).toEqual(['B']);
  });

  it('numbers chunks in document order', () => {
    const chunks = chunkDocument(
      parseMarkdown(`# A\n\n${'a '.repeat(200)}\n\n# B\n\n${'b '.repeat(200)}`, 'Doc'),
    );
    expect(chunks.map((c) => c.ordinal)).toEqual([0, 1]);
  });
});

describe('hashChunk', () => {
  it('depends on both heading path and content', () => {
    expect(hashChunk(['A'], 'x')).not.toBe(hashChunk(['B'], 'x'));
    expect(hashChunk(['A'], 'x')).not.toBe(hashChunk(['A'], 'y'));
    expect(hashChunk(['A'], 'x')).toBe(hashChunk(['A'], 'x'));
  });
});
