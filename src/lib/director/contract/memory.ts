/**
 * Director memory contract — mirrors the backend's
 * `src/lib/production-agent/memory/types.ts`. Kept in lockstep with the server
 * so the desktop speaks the exact same shape the `/api/production-agent/memories`
 * routes return and accept.
 */

export const DIRECTOR_MEMORY_TYPES = ["user", "preferences", "facts"] as const;

export type DirectorMemoryType = (typeof DIRECTOR_MEMORY_TYPES)[number];

export const DIRECTOR_MEMORY_DEFAULT_TYPE: DirectorMemoryType = "user";

export type DirectorMemory = {
  id: string;
  userId: string;
  type: DirectorMemoryType;
  title: string;
  content: string;
  enabled: boolean;
  embeddingModel?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateDirectorMemoryInput = {
  type: DirectorMemoryType;
  title: string;
  content: string;
};

export type UpdateDirectorMemoryInput = {
  type?: DirectorMemoryType;
  title?: string;
  content?: string;
  enabled?: boolean;
};

export const DIRECTOR_MEMORY_TITLE_MAX = 120;
export const DIRECTOR_MEMORY_CONTENT_MAX = 2000;
