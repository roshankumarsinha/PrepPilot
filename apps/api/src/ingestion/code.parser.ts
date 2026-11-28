import { toSourceLines } from './markdown.parser';
import type { ParsedDocument, SourceLine } from './types';

export const CODE_MAX_CHARS = 2_500;

const LANGUAGES: Record<string, { fence: string; label: string }> = {
  cpp: { fence: 'cpp', label: 'C++' },
  js: { fence: 'javascript', label: 'JavaScript' },
};

export interface CodeFileInfo {
  /** File extension without the dot, e.g. `cpp`. */
  extension: string;
  /** Human title of the problem, e.g. `Merge 2 BST`. */
  title: string;
  /** Folders between the repo (or code-pair root) and the file, e.g. `['Binary Search Tree']`. */
  folders: string[];
}

/**
 * A solution file becomes one section titled after the problem. If it is longer than one
 * chunk, it is split at top-level blocks: a blank line followed by an unindented line, which
 * is where a new comment block, function or class starts.
 */
export function parseCode(text: string, info: CodeFileInfo): ParsedDocument {
  const language = LANGUAGES[info.extension] ?? { fence: info.extension, label: info.extension };
  const lines = toSourceLines(text);
  const heading = `${info.title} (${language.label})`;

  return {
    kind: 'code',
    title: info.title,
    headingPrefix: [],
    sections: [{ headingPath: [...info.folders, heading], headingLines: [], bodyLines: lines }],
    render: (renderLines) => {
      const body = renderLines
        .map((l) => l.text)
        .join('\n')
        .trim();
      return `\`\`\`${language.fence}\n${body}\n\`\`\``;
    },
    blockStarts: topLevelBlockStarts,
    maxChars: CODE_MAX_CHARS,
  };
}

function topLevelBlockStarts(lines: SourceLine[]): number[] {
  const starts: number[] = [];
  lines.forEach((line, i) => {
    const previous = lines[i - 1];
    const startsUnindented = line.text !== '' && !/^\s/.test(line.text);
    if (i > 0 && startsUnindented && previous?.text.trim() === '') starts.push(i);
  });
  return starts;
}

/**
 * Turns a solution file name into a readable title:
 * `12_merge2BST` becomes `Merge 2 BST`, `11_maximumAreaOfRectangle(histogram)` becomes
 * `Maximum Area Of Rectangle (histogram)`.
 */
export function humanizeFileName(baseName: string): string {
  const words = baseName
    .replace(/^\d+[_-]/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s+/g, ' ')
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
