import { z } from 'zod';

/** Glob patterns, matched against paths relative to the repo root (case-insensitive). */
const GlobList = z.array(z.string().trim().min(1));

const RepoName = z
  .string()
  .regex(/^[A-Za-z0-9._-]+$/, 'use letters, digits, ".", "_" or "-" (it becomes a folder name)');

export const RepoConfigSchema = z.object({
  name: RepoName,
  url: z.string().min(1),
  branch: z.string().min(1).optional(),
  description: z.string().optional(),
  topics: z.array(z.string().min(1)).default([]),
  include: GlobList.min(1).default(['**']),
  exclude: GlobList.default([]),
  /**
   * Folders holding the same problems in different languages (e.g. C++ and JS).
   * Files at the same relative path and number under these roots share a problem key.
   */
  codePairs: z.array(z.string().min(1)).default([]),
});

export const ReposFileSchema = z
  .object({
    defaults: z
      .object({
        branch: z.string().min(1).default('main'),
        exclude: GlobList.default([]),
      })
      .prefault({}),
    repos: z.array(RepoConfigSchema).min(1),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    file.repos.forEach((repo, index) => {
      const key = repo.name.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['repos', index, 'name'],
          message: `duplicate repo name "${repo.name}"`,
        });
      }
      seen.add(key);
    });
  });

export type ReposFile = z.infer<typeof ReposFileSchema>;

/** A repo entry with defaults applied; what the sync works with. */
export interface RepoConfig {
  name: string;
  url: string;
  branch: string;
  description: string | null;
  topics: string[];
  include: string[];
  exclude: string[];
  codePairs: string[];
}
