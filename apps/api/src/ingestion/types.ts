export type DocumentKind = 'markdown' | 'text' | 'code';
export type LinkKind = 'chatgpt' | 'youtube' | 'article' | 'other';

/** One line of the source file; `n` is 1-based so it maps straight to a GitHub `#L<n>` anchor. */
export interface SourceLine {
  n: number;
  text: string;
}

/** A heading and everything under it up to the next heading, as raw source lines. */
export interface Section {
  headingPath: string[];
  /** Raw lines of the heading itself (empty for text before the first heading). */
  headingLines: SourceLine[];
  /** Raw lines after the heading. */
  bodyLines: SourceLine[];
}

/** What a parser hands to the chunker. */
export interface ParsedDocument {
  kind: DocumentKind;
  title: string;
  /** Prepended to every section's heading path (e.g. the README's folder name). */
  headingPrefix: string[];
  sections: Section[];
  /** Turns raw lines into the markdown stored and shown for a chunk. */
  render: (lines: SourceLine[]) => string;
  /** Where a long section may be split: indexes of lines that start a new block. */
  blockStarts: (lines: SourceLine[]) => number[];
  /** Maximum rendered characters per chunk. */
  maxChars: number;
}

export interface ExtractedLink {
  url: string;
  kind: LinkKind;
  label: string | null;
}

/** A chunk ready to be stored; `contentHash` decides whether it needs embedding. */
export interface ChunkDraft {
  ordinal: number;
  headingPath: string[];
  content: string;
  contentHash: string;
  startLine: number;
  endLine: number;
  /** Text sent to the embedding model: heading path plus content with URLs stripped. */
  embeddingText: string;
  links: ExtractedLink[];
}
