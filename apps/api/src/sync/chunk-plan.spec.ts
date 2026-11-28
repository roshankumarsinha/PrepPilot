import type { ChunkDraft } from '../ingestion/types';
import { planChunkChanges, type StoredChunk } from './chunk-plan';

const MODEL = 'nomic-embed-text';
const draft = (hash: string, ordinal = 0): ChunkDraft => ({
  ordinal,
  headingPath: ['Doc'],
  content: hash,
  contentHash: hash,
  startLine: 1,
  endLine: 1,
  embeddingText: hash,
  links: [],
});
const stored = (id: number, hash: string, embedModel: string | null = MODEL): StoredChunk => ({
  id,
  contentHash: hash,
  embedModel,
});

describe('planChunkChanges', () => {
  it('keeps unchanged chunks, inserts new ones and removes missing ones', () => {
    const plan = planChunkChanges(
      [stored(1, 'a'), stored(2, 'b')],
      [draft('a'), draft('c', 1)],
      MODEL,
    );

    expect(plan.keep.map((k) => k.id)).toEqual([1]);
    expect(plan.insert.map((d) => d.contentHash)).toEqual(['c']);
    expect(plan.remove).toEqual([2]);
  });

  it('matches duplicated text one-to-one', () => {
    const plan = planChunkChanges([stored(1, 'x'), stored(2, 'x')], [draft('x')], MODEL);
    expect(plan.keep.map((k) => k.id)).toEqual([1]);
    expect(plan.remove).toEqual([2]);
  });

  it('replaces chunks embedded with another model', () => {
    const plan = planChunkChanges([stored(1, 'a', 'old-model')], [draft('a')], MODEL);
    expect(plan.keep).toEqual([]);
    expect(plan.insert.map((d) => d.contentHash)).toEqual(['a']);
    expect(plan.remove).toEqual([1]);
  });

  it('does nothing when the file is unchanged', () => {
    const plan = planChunkChanges([stored(1, 'a')], [draft('a')], MODEL);
    expect(plan.insert).toEqual([]);
    expect(plan.remove).toEqual([]);
  });
});
