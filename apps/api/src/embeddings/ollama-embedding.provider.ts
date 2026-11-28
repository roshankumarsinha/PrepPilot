import { Inject, Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { EMBEDDING_DIMENSIONS } from '../database/schema';
import type { EmbeddingProvider } from './embedding.provider';

const BATCH_SIZE = 16;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;

const EmbedResponseSchema = z.object({ embeddings: z.array(z.array(z.number())) });
const TagsResponseSchema = z.object({ models: z.array(z.object({ name: z.string() })) });

/** Thrown for errors that retrying will not fix (bad model name, wrong dimensions…). */
class PermanentEmbeddingError extends Error {}

/**
 * Embeddings from a local Ollama server. nomic-embed-text was trained with task prefixes, and
 * retrieval is noticeably worse without them, so documents and queries get different ones.
 */
@Injectable()
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(OllamaEmbeddingProvider.name);
  readonly model: string;
  readonly dimensions = EMBEDDING_DIMENSIONS;
  private readonly baseUrl: string;
  private readonly usesNomicPrefixes: boolean;

  constructor(@Inject(ENV) env: Env) {
    this.model = env.EMBED_MODEL;
    this.baseUrl = env.OLLAMA_URL.replace(/\/+$/, '');
    this.usesNomicPrefixes = this.model.startsWith('nomic-embed-text');
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const prefix = this.usesNomicPrefixes ? 'search_document: ' : '';
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE).map((text) => prefix + text);
      vectors.push(...(await this.embedWithRetry(batch)));
    }
    return vectors;
  }

  async embedQuery(text: string): Promise<number[]> {
    const prefix = this.usesNomicPrefixes ? 'search_query: ' : '';
    const [vector] = await this.embedWithRetry([prefix + text]);
    if (!vector) throw new Error('Ollama returned no embedding for the query');
    return vector;
  }

  async checkAvailability(): Promise<{ available: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok)
        return { available: false, error: `Ollama returned HTTP ${response.status}` };
      const { models } = TagsResponseSchema.parse(await response.json());
      const installed = models.some(
        (m) => m.name === this.model || m.name.startsWith(`${this.model}:`),
      );
      return installed
        ? { available: true }
        : {
            available: false,
            error: `Model "${this.model}" is not pulled (run: ollama pull ${this.model})`,
          };
    } catch (error) {
      return {
        available: false,
        error: `Ollama is not reachable at ${this.baseUrl}: ${describe(error)}`,
      };
    }
  }

  private async embedWithRetry(input: string[]): Promise<number[][]> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.embed(input);
      } catch (error) {
        if (error instanceof PermanentEmbeddingError || attempt >= MAX_ATTEMPTS) throw error;
        const delayMs = 500 * 2 ** (attempt - 1);
        this.logger.warn(
          `Embedding attempt ${attempt} failed (${describe(error)}); retrying in ${delayMs} ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private async embed(input: string[]): Promise<number[][]> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, input, truncate: true }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Ollama is not reachable at ${this.baseUrl}: ${describe(error)}`, {
        cause: error,
      });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const message = `Ollama /api/embed returned HTTP ${response.status}: ${body.slice(0, 200)}`;
      // 4xx (e.g. unknown model) will not succeed on retry; 5xx might.
      throw response.status < 500 ? new PermanentEmbeddingError(message) : new Error(message);
    }

    const { embeddings } = EmbedResponseSchema.parse(await response.json());
    if (embeddings.length !== input.length) {
      throw new PermanentEmbeddingError(
        `Ollama returned ${embeddings.length} embeddings for ${input.length} inputs`,
      );
    }
    const wrong = embeddings.find((v) => v.length !== this.dimensions);
    if (wrong) {
      throw new PermanentEmbeddingError(
        `Model "${this.model}" returned ${wrong.length} dimensions; the database expects ${this.dimensions}`,
      );
    }
    return embeddings;
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? ` (${error.cause.message})` : '';
    return `${error.message}${cause}`;
  }
  return String(error);
}
