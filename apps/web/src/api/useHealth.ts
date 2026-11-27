import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from './health';

export const HEALTH_REFRESH_MS = 10_000;

/** Polls the API health endpoint so the page reflects the database going up or down. */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: HEALTH_REFRESH_MS,
    retry: false,
  });
}
