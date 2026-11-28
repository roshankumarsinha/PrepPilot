import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});
// The output is read and embedded, never turned back into HTML, so escaping
// markdown characters (e.g. `C\+\+`, `snake\_case`) only adds noise.
turndown.escape = (text: string) => text;

/** A block starts with an HTML tag, e.g. `<h1>`, `<ul>` or `  <b>`. */
const HTML_BLOCK_START = /^\s*<\/?[a-zA-Z][\w-]*(\s[^>]*)?\/?>/;

const PRE_BLOCK = /<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/gi;
const placeholder = (i: number) => `PREPPILOTCODEBLOCK${i}X`;
const PLACEHOLDER = /PREPPILOTCODEBLOCK(\d+)X/g;

/**
 * Converts the HTML parts of a markdown file to markdown and leaves the markdown parts as
 * they are. Blocks are separated by blank lines; a block is HTML when it starts with a tag.
 * Converting block by block avoids feeding plain markdown to an HTML parser, which would
 * collapse its line breaks.
 *
 * `<pre>` blocks are taken out first and restored as fenced code exactly as written: the
 * notes often put unescaped HTML/JSX inside `<pre><code>`, which an HTML parser would
 * otherwise treat as real elements and flatten.
 */
export function htmlToMarkdown(source: string): string {
  const codeBlocks: string[] = [];
  const withPlaceholders = source.replace(PRE_BLOCK, (_match, inner: string) => {
    codeBlocks.push(preToFencedCode(inner));
    return `\n\n${placeholder(codeBlocks.length - 1)}\n\n`;
  });

  const markdown = withPlaceholders
    .split(/\n[ \t]*\n/)
    .map((block) => (HTML_BLOCK_START.test(block) ? turndown.turndown(block) : block))
    .filter((block) => block.trim() !== '')
    .join('\n\n');

  return markdown
    .replace(PLACEHOLDER, (_match, index: string) => codeBlocks[Number(index)] ?? '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function preToFencedCode(inner: string): string {
  const code = decodeEntities(inner.replace(/<\/?code\b[^>]*>/gi, ''));
  return `\`\`\`\n${dedent(code)}\n\`\`\``;
}

/** Removes the indentation shared by all non-blank lines, plus leading/trailing blank lines. */
function dedent(text: string): string {
  const lines = text.replace(/^\s*\n|\n\s*$/g, '').split('\n');
  const indents = lines
    .filter((l) => l.trim() !== '')
    .map((l) => /^[ \t]*/.exec(l)?.[0].length ?? 0);
  const shared = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(shared)).join('\n');
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#')) return String.fromCodePoint(Number(entity.slice(1)));
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Plain text of an HTML fragment: tags removed, common entities decoded, spaces collapsed. */
export function htmlToPlainText(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
