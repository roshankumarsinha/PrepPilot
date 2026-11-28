/** Injection token for the active {@link EmbeddingProvider}. */
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

/** Turns text into vectors. Swappable so tests can use a fake and the model can change later. */
export interface EmbeddingProvider {
  /** Stored on every chunk so a model change can be detected and re-embedded. */
  readonly model: string;
  readonly dimensions: number;
  /** Embeds note chunks, in order. */
  embedDocuments(texts: string[]): Promise<number[][]>;
  /** Embeds a search query (some models use a different prefix for queries). */
  embedQuery(text: string): Promise<number[]>;
  /** Whether the model can be used right now; reported by /health. */
  checkAvailability(): Promise<{ available: boolean; error?: string }>;
}
