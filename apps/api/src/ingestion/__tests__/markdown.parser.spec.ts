import { chunkDocument } from '../chunker';
import { parseMarkdown } from '../markdown.parser';

const headingPaths = (text: string, title = 'Doc') =>
  parseMarkdown(text, title).sections.map((s) => s.headingPath);

describe('parseMarkdown', () => {
  it('builds heading paths from # headings', () => {
    const text =
      '# Concepts\n\n## Bloom Filter\n\nA set.\n\n### Complexity\n\nO(k)\n\n## B-Trees\n\nTrees.';
    expect(headingPaths(text)).toEqual([
      ['Concepts'],
      ['Concepts', 'Bloom Filter'],
      ['Concepts', 'Bloom Filter', 'Complexity'],
      ['Concepts', 'B-Trees'],
    ]);
  });

  it('treats HTML headings as headings, including multi-line ones with links', () => {
    const text = [
      '<h1>Backend System Design :</h1>',
      '<h2>',
      '  <a href="https://example.org/sd">',
      '    System Design Tutorial',
      '  </a>',
      '</h2>',
      '<ul><li>Monolith</li></ul>',
    ].join('\n');
    const doc = parseMarkdown(text, 'Backend System Design');
    expect(doc.sections.map((s) => s.headingPath)).toEqual([
      ['Backend System Design'],
      ['Backend System Design', 'System Design Tutorial'],
    ]);
    // The multi-line heading is consumed whole: its lines are heading lines, not body.
    expect(doc.sections[1]?.headingLines.map((l) => l.n)).toEqual([2, 3, 4, 5, 6]);
  });

  it('ignores heading-like lines inside fenced code and <pre> blocks', () => {
    const text =
      '# Real\n\n```md\n# not a heading\n```\n\n<pre><code>\n<h1>Hello</h1>\n</code></pre>\n';
    expect(headingPaths(text)).toEqual([['Real']]);
  });

  it('drops the title prefix when the first heading already is the title', () => {
    expect(
      parseMarkdown('# Some Important Concepts\n\ntext', 'Some-Important-Concepts').headingPrefix,
    ).toEqual([]);
    expect(parseMarkdown('# Episode 1\n\ntext', 'namaste-react').headingPrefix).toEqual([
      'namaste-react',
    ]);
  });

  it('strips markdown syntax from heading text', () => {
    expect(headingPaths('## [**Bloom** `Filter`](#bloom):\n\ntext')).toEqual([['Bloom Filter']]);
  });
});

describe('chunking markdown', () => {
  it('turns an HTML README into markdown and keeps the links', () => {
    const text = [
      '<h1>Accessibilty</h1>',
      '<h2>ChatGpt Notes : <a href="https://chatgpt.com/share/68b1-abc" target="_blank">ChatGPT Notes</a></h2>',
      '<h2>Common Notes : <a href="https://web.dev/learn/accessibility/aria-html">Common Notes</a></h2>',
    ].join('\n');
    const [chunk, ...rest] = chunkDocument(parseMarkdown(text, 'Accessibility'));

    expect(rest).toEqual([]);
    expect(chunk?.headingPath).toEqual(['Accessibility', 'Accessibilty']);
    expect(chunk?.content).toContain(
      '## ChatGpt Notes : [ChatGPT Notes](https://chatgpt.com/share/68b1-abc)',
    );
    expect(chunk?.links).toEqual([
      { url: 'https://chatgpt.com/share/68b1-abc', kind: 'chatgpt', label: 'ChatGPT Notes' },
      {
        url: 'https://web.dev/learn/accessibility/aria-html',
        kind: 'article',
        label: 'Common Notes',
      },
    ]);
    // URLs are not embedded, only their labels.
    expect(chunk?.embeddingText).not.toContain('https://');
    expect(chunk?.embeddingText).toContain('ChatGPT Notes');
  });

  it('keeps code inside <pre><code> exactly as written', () => {
    const text =
      '# Virtual DOM\n\nExample:\n<pre>\n  <code>\n    <div id="app">\n      <h1>Hello</h1>\n    </div>\n  </code>\n</pre>';
    const [chunk] = chunkDocument(parseMarkdown(text, 'React'));
    expect(chunk?.content).toContain('```\n<div id="app">\n  <h1>Hello</h1>\n</div>\n```');
  });

  it('records the exact source lines of each chunk', () => {
    const text = '# A\n\nalpha '.padEnd(400, 'a') + '\n\n# B\n\nbeta '.padEnd(400, 'b');
    const chunks = chunkDocument(parseMarkdown(text, 'Doc'));
    expect(chunks.map((c) => [c.headingPath.at(-1), c.startLine, c.endLine])).toEqual([
      ['A', 1, 4],
      ['B', 5, 7],
    ]);
  });

  it('drops sections that are only a heading', () => {
    const text =
      '# Module 1\n\n## What is Claude?\n\n### Overview\n\n' + 'Claude is a model. '.repeat(30);
    const chunks = chunkDocument(parseMarkdown(text, 'Claude 101'));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.headingPath).toEqual([
      'Claude 101',
      'Module 1',
      'What is Claude?',
      'Overview',
    ]);
  });
});
