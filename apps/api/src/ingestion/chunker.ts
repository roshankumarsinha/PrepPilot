import { createHash } from 'node:crypto';
import { extractLinks, stripUrls } from './links';
import type { ChunkDraft, ParsedDocument, SourceLine } from './types';

/** Rendered characters carried from the end of one piece of a long section into the next. */
export const OVERLAP_CHARS = 200;
/** Sections smaller than this are merged into the previous section when they are related. */
export const MIN_SECTION_CHARS = 300;

/** A run of source lines that will become one or more chunks under a single heading path. */
interface Unit {
  headingPath: string[];
  /** Lines of the unit's own heading; a split piece always starts with them. */
  headingLines: SourceLine[];
  /** Heading lines of every section merged into this unit. */
  allHeadingLines: Set<SourceLine>;
  lines: SourceLine[];
}

/**
 * Turns parsed sections into chunks:
 * 1. Tiny sections (e.g. a two-line "Expected Output") are merged into the previous section
 *    when that is their parent or sibling, so search results are never just a fragment.
 * 2. A unit that fits in `maxChars` becomes one chunk. A longer one is packed block by block
 *    (blocks come from the parser), and each extra piece starts with the last few lines of the
 *    previous one so no idea is cut off without context.
 */
export function chunkDocument(doc: ParsedDocument): ChunkDraft[] {
  const drafts: Omit<ChunkDraft, 'ordinal'>[] = [];
  for (const unit of mergeSmallSections(doc)) {
    const headingPath = [...doc.headingPrefix, ...unit.headingPath];
    for (const lines of splitUnit(doc, unit)) {
      const draft = buildDraft(doc, headingPath, lines, unit);
      if (draft) drafts.push(draft);
    }
  }
  return drafts.map((draft, ordinal) => ({ ...draft, ordinal }));
}

function mergeSmallSections(doc: ParsedDocument): Unit[] {
  const units: Unit[] = [];
  for (const section of doc.sections) {
    const unit: Unit = {
      headingPath: section.headingPath,
      headingLines: section.headingLines,
      allHeadingLines: new Set(section.headingLines),
      lines: [...section.headingLines, ...section.bodyLines],
    };
    const previous = units.at(-1);
    if (
      previous &&
      doc.render(unit.lines).length < MIN_SECTION_CHARS &&
      isParentOrSibling(previous.headingPath, unit.headingPath) &&
      doc.render([...previous.lines, ...unit.lines]).length <= doc.maxChars
    ) {
      previous.lines.push(...unit.lines);
      unit.headingLines.forEach((line) => previous.allHeadingLines.add(line));
      continue;
    }
    units.push(unit);
  }
  return units;
}

function isParentOrSibling(previous: string[], current: string[]): boolean {
  const parent = current.slice(0, -1);
  const startsWith = (path: string[], prefix: string[]) => prefix.every((p, i) => path[i] === p);
  return (
    current.length > 0 &&
    previous.length >= parent.length &&
    previous.length <= current.length &&
    startsWith(previous, parent)
  );
}

function splitUnit(doc: ParsedDocument, unit: Unit): SourceLine[][] {
  if (doc.render(unit.lines).length <= doc.maxChars) return [unit.lines];

  const body = unit.lines.slice(unit.headingLines.length);
  const pieces: SourceLine[][] = [];
  let current: SourceLine[] = [...unit.headingLines];

  for (const block of toBlocks(doc, body)) {
    const candidate = [...current, ...block];
    if (doc.render(candidate).length <= doc.maxChars) {
      current = candidate;
      continue;
    }
    if (current.length > unit.headingLines.length) pieces.push(current);
    const withOverlap = [...overlapTail(doc, current), ...block];
    current = doc.render(withOverlap).length <= doc.maxChars ? withOverlap : block;
  }
  if (current.length > 0) pieces.push(current);
  return pieces;
}

/** Splits lines into blocks at the parser's boundaries; oversized blocks are cut by lines. */
function toBlocks(doc: ParsedDocument, lines: SourceLine[]): SourceLine[][] {
  const starts = [0, ...doc.blockStarts(lines).filter((i) => i > 0), lines.length];
  const blocks: SourceLine[][] = [];
  for (let b = 0; b < starts.length - 1; b++) {
    const block = lines.slice(starts[b], starts[b + 1]);
    if (block.length === 0) continue;
    if (doc.render(block).length <= doc.maxChars) {
      blocks.push(block);
      continue;
    }
    let piece: SourceLine[] = [];
    for (const line of block) {
      if (piece.length > 0 && doc.render([...piece, line]).length > doc.maxChars) {
        blocks.push(piece);
        piece = [];
      }
      piece.push(line);
    }
    if (piece.length > 0) blocks.push(piece);
  }
  return blocks;
}

function overlapTail(doc: ParsedDocument, lines: SourceLine[]): SourceLine[] {
  const tail: SourceLine[] = [];
  for (const line of [...lines].reverse()) {
    if (doc.render([line, ...tail]).length > OVERLAP_CHARS) break;
    tail.unshift(line);
  }
  return tail;
}

function buildDraft(
  doc: ParsedDocument,
  headingPath: string[],
  lines: SourceLine[],
  unit: Unit,
): Omit<ChunkDraft, 'ordinal'> | null {
  const first = lines[0];
  const last = lines.at(-1);
  const content = doc.render(lines);
  const links = extractLinks(lines.map((l) => l.text).join('\n'));
  const body = doc.render(lines.filter((l) => !unit.allHeadingLines.has(l)));
  if (!first || !last || content === '' || (body === '' && links.length === 0)) return null;

  return {
    headingPath,
    content,
    contentHash: hashChunk(headingPath, content),
    startLine: first.n,
    endLine: last.n,
    embeddingText: `${headingPath.join(' > ')}\n\n${stripUrls(content)}`.trim(),
    links,
  };
}

/** Identity of a chunk: same heading path and content means the stored embedding is still valid. */
export function hashChunk(headingPath: string[], content: string): string {
  return createHash('sha256')
    .update(JSON.stringify([headingPath, content]))
    .digest('hex');
}
