import { createHash } from 'node:crypto';
import type { EmbeddingProvider } from '../src/embeddings/embedding.provider';

/** Deterministic embeddings derived from the text, so tests need no Ollama. Counts calls. */
export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'fake-embed';
  readonly dimensions = 768;
  readonly embedded: string[] = [];

  embedDocuments(texts: string[]): Promise<number[][]> {
    this.embedded.push(...texts);
    return Promise.resolve(texts.map((text) => this.vector(text)));
  }

  embedQuery(text: string): Promise<number[]> {
    return Promise.resolve(this.vector(text));
  }

  checkAvailability(): Promise<{ available: boolean }> {
    return Promise.resolve({ available: true });
  }

  private vector(text: string): number[] {
    const digest = createHash('sha256').update(text).digest();
    return Array.from(
      { length: this.dimensions },
      (_, i) => (digest[i % digest.length] ?? 0) / 255,
    );
  }
}
