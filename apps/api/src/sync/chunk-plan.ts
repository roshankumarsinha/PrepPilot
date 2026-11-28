import type { ChunkDraft } from '../ingestion/types';

export interface StoredChunk {
  id: number;
  contentHash: string;
  embedModel: string | null;
}

export interface ChunkPlan {
  /** Stored chunks whose text is unchanged; only their position and line numbers are updated. */
  keep: { id: number; draft: ChunkDraft }[];
  /** New chunks; these need an embedding (reused if the same text is embedded elsewhere). */
  insert: ChunkDraft[];
  /** Stored chunks that no longer exist in the file. */
  remove: number[];
}

/**
 * Matches a file's new chunks to its stored chunks by content hash. Duplicated text is
 * matched one-to-one, and a stored chunk embedded with a different model is replaced so the
 * whole index always uses one model.
 */
export function planChunkChanges(
  stored: StoredChunk[],
  drafts: ChunkDraft[],
  model: string,
): ChunkPlan {
  const available = new Map<string, number[]>();
  const remove: number[] = [];
  for (const chunk of stored) {
    if (chunk.embedModel !== model) {
      remove.push(chunk.id);
      continue;
    }
    available.set(chunk.contentHash, [...(available.get(chunk.contentHash) ?? []), chunk.id]);
  }

  const keep: ChunkPlan['keep'] = [];
  const insert: ChunkDraft[] = [];
  for (const draft of drafts) {
    const id = available.get(draft.contentHash)?.shift();
    if (id === undefined) insert.push(draft);
    else keep.push({ id, draft });
  }

  for (const ids of available.values()) remove.push(...ids);
  return { keep, insert, remove };
}
