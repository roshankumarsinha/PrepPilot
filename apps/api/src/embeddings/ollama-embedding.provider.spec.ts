import { Logger } from '@nestjs/common';
import { testEnv } from '../testing/test-env';
import { OllamaEmbeddingProvider } from './ollama-embedding.provider';

const vector = (seed: number) => Array.from({ length: 768 }, () => seed);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('OllamaEmbeddingProvider', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const provider = new OllamaEmbeddingProvider(testEnv({ OLLAMA_URL: 'http://ollama:11434/' }));

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const sentBody = (call = 0) =>
    JSON.parse(fetchMock.mock.calls[call]?.[1]?.body as string) as {
      model: string;
      input: string[];
    };

  it('adds the nomic document prefix and returns vectors in order', async () => {
    fetchMock.mockResolvedValue(json({ embeddings: [vector(1), vector(2)] }));

    const result = await provider.embedDocuments(['alpha', 'beta']);

    expect(result.map((v) => v[0])).toEqual([1, 2]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://ollama:11434/api/embed');
    expect(sentBody()).toMatchObject({
      model: 'nomic-embed-text',
      input: ['search_document: alpha', 'search_document: beta'],
    });
  });

  it('uses the query prefix for search queries', async () => {
    fetchMock.mockResolvedValue(json({ embeddings: [vector(3)] }));
    await provider.embedQuery('consistent hashing');
    expect(sentBody().input).toEqual(['search_query: consistent hashing']);
  });

  it('sends large inputs in batches of 16', async () => {
    fetchMock.mockImplementation((_url, init) => {
      const { input } = JSON.parse(init?.body as string) as { input: string[] };
      return Promise.resolve(json({ embeddings: input.map(() => vector(0)) }));
    });
    await provider.embedDocuments(Array.from({ length: 40 }, (_, i) => `t${i}`));
    expect(fetchMock.mock.calls.map((_, i) => sentBody(i).input.length)).toEqual([16, 16, 8]);
  });

  it('retries a server error and then succeeds', async () => {
    jest.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(json({ error: 'busy' }, 503))
      .mockResolvedValueOnce(json({ embeddings: [vector(4)] }));

    const pending = provider.embedDocuments(['x']);
    await jest.runAllTimersAsync();

    await expect(pending).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not retry an unknown model', async () => {
    fetchMock.mockResolvedValue(json({ error: 'model not found' }, 404));
    await expect(provider.embedDocuments(['x'])).rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects vectors with the wrong number of dimensions', async () => {
    fetchMock.mockResolvedValue(json({ embeddings: [[0.1, 0.2]] }));
    await expect(provider.embedDocuments(['x'])).rejects.toThrow(/returned 2 dimensions/);
  });

  it('reports a missing model as unavailable with the command to fix it', async () => {
    fetchMock.mockResolvedValue(json({ models: [{ name: 'llama3:latest' }] }));
    await expect(provider.checkAvailability()).resolves.toEqual({
      available: false,
      error: 'Model "nomic-embed-text" is not pulled (run: ollama pull nomic-embed-text)',
    });
  });

  it('reports the model as available when it is pulled with a tag', async () => {
    fetchMock.mockResolvedValue(json({ models: [{ name: 'nomic-embed-text:latest' }] }));
    await expect(provider.checkAvailability()).resolves.toEqual({ available: true });
  });
});
