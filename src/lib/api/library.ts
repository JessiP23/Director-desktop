/**
 * Typed endpoints for the user-scoped Director "library": memories, skills, and
 * connector tools. These mirror the backend's `/api/production-agent/{memories,
 * skills,connectors}` routes — one function per operation so the UI never
 * hand-builds URLs or payloads.
 *
 * Reads here are deliberately thin: callers go through the cached resource
 * layer (`@/lib/data/resource-store`) so a list is fetched once and shared, not
 * re-requested on every agent output.
 */
import { apiClient } from "@/lib/api/client";
import type {
  CreateDirectorMemoryInput,
  DirectorMemory,
  UpdateDirectorMemoryInput,
} from "@/lib/director/contract/memory";
import type {
  CreateDirectorSkillInput,
  DirectorSkill,
  UpdateDirectorSkillInput,
} from "@/lib/director/contract/skills";
import type {
  DirectorConnectorState,
  SaveDirectorConnectorSettingsInput,
} from "@/lib/director/contract/connectors";

const MEMORIES = "/api/production-agent/memories";
const SKILLS = "/api/production-agent/skills";
const CONNECTORS = "/api/production-agent/connectors";

export const memoriesApi = {
  list: () => apiClient.get<{ memories: DirectorMemory[] }>(MEMORIES).then((r) => r.memories),

  create: (input: CreateDirectorMemoryInput) =>
    apiClient.post<{ memory: DirectorMemory }>(MEMORIES, input).then((r) => r.memory),

  update: (id: string, patch: UpdateDirectorMemoryInput) =>
    apiClient.patch<{ memory: DirectorMemory }>(`${MEMORIES}/${id}`, patch).then((r) => r.memory),

  remove: (id: string) => apiClient.delete<unknown>(`${MEMORIES}/${id}`),
};

export const skillsApi = {
  list: () => apiClient.get<{ skills: DirectorSkill[] }>(SKILLS).then((r) => r.skills),

  create: (input: CreateDirectorSkillInput) =>
    apiClient.post<{ skill: DirectorSkill }>(SKILLS, input).then((r) => r.skill),

  update: (id: string, patch: UpdateDirectorSkillInput) =>
    apiClient.patch<{ skill: DirectorSkill }>(`${SKILLS}/${id}`, patch).then((r) => r.skill),

  remove: (id: string) => apiClient.delete<unknown>(`${SKILLS}/${id}`),
};

export const connectorsApi = {
  // The backend wraps the payload as `{ success, settings, defaultTools }`.
  get: () =>
    apiClient
      .get<{ settings: DirectorConnectorState["settings"]; defaultTools: DirectorConnectorState["defaultTools"] }>(
        CONNECTORS,
      )
      .then((r): DirectorConnectorState => ({ settings: r.settings, defaultTools: r.defaultTools })),

  // Saving is a PUT (full replace of the user's enabled apps + tool selection).
  save: (input: SaveDirectorConnectorSettingsInput) =>
    apiClient
      .put<{ settings: DirectorConnectorState["settings"] }>(CONNECTORS, input)
      .then((r) => r.settings),
};
