import { z } from 'zod';

/** Whether a dependency answered its health probe. */
export const DependencyStatusSchema = z.enum(['up', 'down']);
export type DependencyStatus = z.infer<typeof DependencyStatusSchema>;

/** `ok` when every dependency is up, `degraded` when at least one is down. */
export const HealthStatusSchema = z.enum(['ok', 'degraded']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const DependencyHealthSchema = z.object({
  status: DependencyStatusSchema,
  /** Round-trip time of the probe in milliseconds. */
  latencyMs: z.number().nonnegative(),
  /** Why the probe failed; only present when `status` is `down`. */
  error: z.string().optional(),
});
export type DependencyHealth = z.infer<typeof DependencyHealthSchema>;

/** Body returned by `GET /health`, for both 200 and 503 responses. */
export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  db: DependencyHealthSchema,
  /** Ollama with the embedding model pulled; needed to sync notes. */
  ollama: DependencyHealthSchema,
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
