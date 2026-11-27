import { describe, expect, it } from 'vitest';
import { HealthResponseSchema, type HealthResponse } from './health.js';

const healthy: HealthResponse = {
  status: 'ok',
  db: { status: 'up', latencyMs: 2 },
  uptimeSeconds: 12,
  timestamp: '2026-11-27T10:00:00.000Z',
};

describe('HealthResponseSchema', () => {
  it('accepts a healthy response', () => {
    expect(HealthResponseSchema.parse(healthy)).toEqual(healthy);
  });

  it('accepts a degraded response with a database error', () => {
    const degraded = {
      ...healthy,
      status: 'degraded',
      db: { status: 'down', latencyMs: 2000, error: 'connection refused' },
    };
    expect(HealthResponseSchema.safeParse(degraded).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(HealthResponseSchema.safeParse({ ...healthy, status: 'broken' }).success).toBe(false);
  });

  it('rejects a timestamp that is not ISO 8601', () => {
    expect(HealthResponseSchema.safeParse({ ...healthy, timestamp: 'yesterday' }).success).toBe(
      false,
    );
  });
});
