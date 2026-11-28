import { createHash } from 'node:crypto';
import { basename, dirname, extname } from 'node:path';
import { chunkDocument } from './chunker';
import { humanizeFileName, parseCode } from './code.parser';
import { parseMarkdown } from './markdown.parser';
import { PARSER_VERSION } from './parser-version';
import { parseText } from './text.parser';
import type { ChunkDraft, DocumentKind } from './types';

const KIND_BY_EXTENSION: Record<string, DocumentKind> = {
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.txt': 'text',
  '.cpp': 'code',
  '.js': 'code',
};

export interface DocumentInput {
  repoName: string;
  /** Path relative to the repo root, with `/` separators. */
  path: string;
  content: string;
  /** Code-pair roots from repos.yaml, e.g. `['General-DSA-Questions', 'JS-DSA-Questions']`. */
  codePairs: string[];
}

export interface ProcessedDocument {
  kind: DocumentKind;
  title: string;
  contentHash: string;
  problemKey: string | null;
  chunks: ChunkDraft[];
}

export function isSupportedFile(path: string): boolean {
  return extname(path).toLowerCase() in KIND_BY_EXTENSION;
}

/** Parses and chunks one file. Returns null for file types we do not index. */
export function processDocument(input: DocumentInput): ProcessedDocument | null {
  const extension = extname(input.path).toLowerCase();
  const kind = KIND_BY_EXTENSION[extension];
  if (!kind) return null;

  const contentHash = createHash('sha256')
    .update(`v${PARSER_VERSION}\n${input.content}`)
    .digest('hex');

  if (kind === 'code') {
    const pair = codePairOf(input.path, input.codePairs);
    const relative = pair ? input.path.slice(pair.length + 1) : input.path;
    const title = humanizeFileName(basename(relative, extname(relative)));
    const folders = dirname(relative) === '.' ? [] : dirname(relative).split('/');
    const parsed = parseCode(input.content, { extension: extension.slice(1), title, folders });
    return {
      kind,
      title,
      contentHash,
      problemKey: pair ? problemKey(relative) : null,
      chunks: chunkDocument(parsed),
    };
  }

  const title = documentTitle(input.repoName, input.path);
  const parsed =
    kind === 'markdown' ? parseMarkdown(input.content, title) : parseText(input.content, title);
  return { kind, title, contentHash, problemKey: null, chunks: chunkDocument(parsed) };
}

/**
 * Title used as the first heading of every chunk: a README is named after its folder (or the
 * repo, at the root); any other file after its own name.
 */
export function documentTitle(repoName: string, path: string): string {
  const name = basename(path, extname(path));
  if (/^readme\d*$/i.test(name)) {
    const folder = dirname(path);
    return folder === '.' ? repoName : basename(folder);
  }
  return humanizeFileName(name);
}

function codePairOf(path: string, roots: string[]): string | undefined {
  return roots.find((root) => path.toLowerCase().startsWith(`${root.toLowerCase()}/`));
}

/**
 * Key shared by the C++ and JS versions of a problem: the folder plus the problem number
 * (`Binary Search Tree/12`), or the lower-cased file name when there is no number.
 */
export function problemKey(relativePath: string): string {
  const folder = dirname(relativePath);
  const name = basename(relativePath, extname(relativePath));
  const id = /^(\d+)[_-]/.exec(name)?.[1] ?? name.toLowerCase();
  return folder === '.' ? id : `${folder}/${id}`;
}
