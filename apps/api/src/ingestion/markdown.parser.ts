import { htmlToMarkdown, htmlToPlainText } from './html-to-markdown';
import type { ParsedDocument, Section, SourceLine } from './types';

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX_HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
const HTML_HEADING_OPEN = /^\s*<h([1-6])\b[^>]*>/i;
const PRE_OPEN = /<pre\b/i;
const PRE_CLOSE = /<\/pre\s*>/i;
/** Max lines an HTML heading may span, e.g. `<h1>\n  <a ...>Title</a>\n</h1>`. */
const MAX_HTML_HEADING_LINES = 12;

export const MARKDOWN_MAX_CHARS = 1_500;

interface Heading {
  level: number;
  text: string;
  /** Index of the heading's last line, so multi-line HTML headings are consumed whole. */
  endIndex: number;
}

/**
 * Splits a markdown file into sections at headings. Both `#` headings and HTML `<h1>`–`<h6>`
 * headings count (many notes are written in HTML), and nothing inside a fenced code block
 * or a `<pre>` block is treated as a heading.
 */
export function parseMarkdown(text: string, title: string): ParsedDocument {
  const lines = toSourceLines(text);
  const sections: Section[] = [];
  const stack: { level: number; text: string }[] = [];
  let current: Section = { headingPath: [], headingLines: [], bodyLines: [] };
  let fence: string | null = null;
  let inPre = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break;
    if (inPre || PRE_OPEN.test(line.text)) {
      // Code examples inside <pre> may contain <h1> etc.; they are never headings.
      const opensHere = PRE_OPEN.test(line.text);
      const closesAfterOpen = PRE_CLOSE.test(line.text.slice(line.text.search(PRE_OPEN)));
      inPre = opensHere ? !closesAfterOpen : !PRE_CLOSE.test(line.text);
      current.bodyLines.push(line);
      continue;
    }
    const fenceMatch = FENCE.exec(line.text);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1];
      if (fence === null) fence = marker;
      else if (marker.startsWith(fence.charAt(0)) && marker.length >= fence.length) fence = null;
      current.bodyLines.push(line);
      continue;
    }

    const heading = fence === null ? readHeading(lines, i) : null;
    if (!heading) {
      current.bodyLines.push(line);
      continue;
    }

    sections.push(current);
    while (stack.length > 0 && (stack.at(-1)?.level ?? 0) >= heading.level) stack.pop();
    stack.push({ level: heading.level, text: heading.text });
    current = {
      headingPath: stack.map((h) => h.text),
      headingLines: lines.slice(i, heading.endIndex + 1),
      bodyLines: [],
    };
    i = heading.endIndex;
  }
  sections.push(current);

  const firstHeading = sections.find((s) => s.headingPath.length > 0)?.headingPath[0];
  return {
    kind: 'markdown',
    title,
    headingPrefix: firstHeading && sameTitle(firstHeading, title) ? [] : [title],
    sections: sections.filter((s) => s.headingLines.length > 0 || hasText(s.bodyLines)),
    render: (renderLines) => htmlToMarkdown(renderLines.map((l) => l.text).join('\n')),
    blockStarts: blankLineBlockStarts,
    maxChars: MARKDOWN_MAX_CHARS,
  };
}

function readHeading(lines: SourceLine[], index: number): Heading | null {
  const text = lines[index]?.text ?? '';

  const atx = ATX_HEADING.exec(text);
  if (atx?.[1] && atx[2]) {
    return { level: atx[1].length, text: cleanHeadingText(atx[2]), endIndex: index };
  }

  const html = HTML_HEADING_OPEN.exec(text);
  if (html?.[1]) {
    const close = new RegExp(`</h${html[1]}\\s*>`, 'i');
    const last = Math.min(lines.length - 1, index + MAX_HTML_HEADING_LINES);
    for (let end = index; end <= last; end++) {
      if (close.test(lines[end]?.text ?? '')) {
        const raw = lines
          .slice(index, end + 1)
          .map((l) => l.text)
          .join(' ');
        const headingText = cleanHeadingText(htmlToPlainText(raw));
        return headingText ? { level: Number(html[1]), text: headingText, endIndex: end } : null;
      }
    }
  }
  return null;
}

/** Heading text without markdown syntax, e.g. `[**Bloom** Filter](#x)` becomes `Bloom Filter`. */
export function cleanHeadingText(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*$/, '')
    .trim();
}

export function toSourceLines(text: string): SourceLine[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line, i) => ({ n: i + 1, text: line }));
}

/** A new block starts at each non-blank line that follows a blank line. */
export function blankLineBlockStarts(lines: SourceLine[]): number[] {
  const starts: number[] = [];
  lines.forEach((line, i) => {
    const previous = lines[i - 1];
    if (i > 0 && line.text.trim() !== '' && previous?.text.trim() === '') starts.push(i);
  });
  return starts;
}

function hasText(lines: SourceLine[]): boolean {
  return lines.some((l) => l.text.trim() !== '');
}

function sameTitle(a: string, b: string): boolean {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalise(a) === normalise(b);
}
