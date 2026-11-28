import { blankLineBlockStarts, toSourceLines } from './markdown.parser';
import type { ParsedDocument, Section, SourceLine } from './types';

const UNDERLINE = /^\s*(={3,}|-{3,})\s*$/;
const NUMBERED_QUESTION = /^\s*\d+[.)]\s/;

export const TEXT_MAX_CHARS = 1_500;

/**
 * Splits a plain-text note into sections at "underlined" headings:
 *
 *     IMPORTANT NODE.JS INTERVIEW QUESTIONS     <- level 1 (underlined with ===)
 *     ======================================
 *     1. What is Node.js?                       <- level 2 (numbered, underlined with ---)
 *     -------------------
 *     Real-World Analogy:                       <- level 3 (underlined with ---)
 *     -------------------
 *
 * Lines made only of `=` or `-` are layout, so they are dropped from the rendered text.
 */
export function parseText(text: string, title: string): ParsedDocument {
  const lines = toSourceLines(text);
  const sections: Section[] = [];
  const stack: { level: number; text: string }[] = [];
  let current: Section = { headingPath: [], headingLines: [], bodyLines: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) break;
    const next = lines[i + 1];
    const isHeading =
      next !== undefined &&
      line.text.trim() !== '' &&
      !UNDERLINE.test(line.text) &&
      UNDERLINE.test(next.text);

    if (!isHeading) {
      current.bodyLines.push(line);
      continue;
    }

    const level = next.text.trim().startsWith('=') ? 1 : NUMBERED_QUESTION.test(line.text) ? 2 : 3;
    sections.push(current);
    while (stack.length > 0 && (stack.at(-1)?.level ?? 0) >= level) stack.pop();
    stack.push({ level, text: line.text.trim().replace(/\s*:$/, '') });
    current = { headingPath: stack.map((h) => h.text), headingLines: [line, next], bodyLines: [] };
    i += 1;
  }
  sections.push(current);

  return {
    kind: 'text',
    title,
    headingPrefix: [title],
    sections: sections.filter((s) => s.headingLines.length > 0 || hasContent(s.bodyLines)),
    render: (renderLines) =>
      renderLines
        .filter((l) => !UNDERLINE.test(l.text))
        .map((l) => l.text)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    blockStarts: blankLineBlockStarts,
    maxChars: TEXT_MAX_CHARS,
  };
}

function hasContent(lines: SourceLine[]): boolean {
  return lines.some((l) => l.text.trim() !== '' && !UNDERLINE.test(l.text));
}
