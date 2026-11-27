import { z } from 'zod';

/** Whether the database answered the health probe. */
export const DependencyStatusSchema = z.enum(['up', 'down']);
export type DependencyStatus = z.infer<typeof DependencyStatusSchema>;

/** `ok` when every dependency is up, `degraded` when at least one is down. */
export const HealthStatusSchema = z.enum(['ok', 'degraded']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const DatabaseHealthSchema = z.object({
  status: DependencyStatusSchema,
  /** Round-trip time of the probe query in milliseconds. */
  latencyMs: z.number().nonnegative(),
  /** Why the probe failed; only present when `status` is `down`. */
  error: z.string().optional(),
});
export type DatabaseHealth = z.infer<typeof DatabaseHealthSchema>;

/** Body returned by `GET /health`, for both 200 and 503 responses. */
export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  db: DatabaseHealthSchema,
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
