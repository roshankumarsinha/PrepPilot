import { describe, expect, it, vi } from 'vitest';
import { degradedResponse, healthyResponse, jsonResponse } from '../test/fixtures';
import { fetchHealth, HEALTH_URL, HealthRequestError } from './health';

describe('fetchHealth', () => {
  it('returns the parsed report on 200', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(healthyResponse));

    await expect(fetchHealth()).resolves.toEqual(healthyResponse);
    expect(fetchMock).toHaveBeenCalledWith(HEALTH_URL, expect.anything());
  });

  it('returns the degraded report on 503 instead of throwing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(degradedResponse, 503));

    await expect(fetchHealth()).resolves.toEqual(degradedResponse);
  });

  it('throws a HealthRequestError when the API is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchHealth()).rejects.toBeInstanceOf(HealthRequestError);
  });

  it('throws a HealthRequestError when the body is not a health report', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

    await expect(fetchHealth()).rejects.toThrow('Unexpected response from the API (HTTP 502).');
  });
});
