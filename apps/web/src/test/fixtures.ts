import type { HealthResponse } from '@preppilot/shared';

export const healthyResponse: HealthResponse = {
  status: 'ok',
  db: { status: 'up', latencyMs: 3 },
  ollama: { status: 'up', latencyMs: 8 },
  uptimeSeconds: 125,
  timestamp: '2026-11-27T10:00:00.000Z',
};

export const degradedResponse: HealthResponse = {
  status: 'degraded',
  db: { status: 'down', latencyMs: 2000, error: 'connect ECONNREFUSED 127.0.0.1:5432' },
  ollama: { status: 'up', latencyMs: 8 },
  uptimeSeconds: 125,
  timestamp: '2026-11-27T10:00:00.000Z',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
