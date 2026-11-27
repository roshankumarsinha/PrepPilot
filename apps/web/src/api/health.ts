import { HealthResponseSchema, type HealthResponse } from '@preppilot/shared';

export const HEALTH_URL = '/api/health';

/** Thrown when the API is unreachable or returns something that is not a health report. */
export class HealthRequestError extends Error {
  override readonly name = 'HealthRequestError';
}

/**
 * Calls `GET /health`. A 503 still carries a valid health report (status `degraded`),
 * so it resolves; only an unreachable API or an unexpected body rejects.
 */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  let response: Response;
  try {
    response = await fetch(HEALTH_URL, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new HealthRequestError('Could not reach the API. Is `pnpm dev` running?');
  }

  const body: unknown = await response.json().catch(() => undefined);
  const parsed = HealthResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new HealthRequestError(`Unexpected response from the API (HTTP ${response.status}).`);
  }
  return parsed.data;
}
