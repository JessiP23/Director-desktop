/**
 * Module-level stores for the user-scoped library resources. Importing these
 * gives every component the same cached list — the data is fetched once and
 * mutations patch the cache in place, so panels stay instant and never re-list
 * on each agent output.
 */
import { connectorsApi, memoriesApi, skillsApi } from "@/lib/api/library";
import { createResourceStore } from "@/lib/data/resource-store";
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

export const memoriesStore = createResourceStore<DirectorMemory[]>(() => memoriesApi.list());
export const skillsStore = createResourceStore<DirectorSkill[]>(() => skillsApi.list());
export const connectorsStore = createResourceStore<DirectorConnectorState>(() => connectorsApi.get());

/** Sort newest-first so a freshly created item lands at the top. */
function byNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const memories = {
  async create(input: CreateDirectorMemoryInput) {
    const created = await memoriesApi.create(input);
    memoriesStore.update((current) => byNewest([created, ...(current ?? [])]));
    return created;
  },
  async update(id: string, patch: UpdateDirectorMemoryInput) {
    const updated = await memoriesApi.update(id, patch);
    memoriesStore.update((current) => (current ?? []).map((m) => (m.id === id ? updated : m)));
    return updated;
  },
  async remove(id: string) {
    await memoriesApi.remove(id);
    memoriesStore.update((current) => (current ?? []).filter((m) => m.id !== id));
  },
};

export const skills = {
  async create(input: CreateDirectorSkillInput) {
    const created = await skillsApi.create(input);
    skillsStore.update((current) => byNewest([created, ...(current ?? [])]));
    return created;
  },
  async update(id: string, patch: UpdateDirectorSkillInput) {
    const updated = await skillsApi.update(id, patch);
    skillsStore.update((current) => (current ?? []).map((s) => (s.id === id ? updated : s)));
    return updated;
  },
  async remove(id: string) {
    await skillsApi.remove(id);
    skillsStore.update((current) => (current ?? []).filter((s) => s.id !== id));
  },
};

export const connectors = {
  async save(input: SaveDirectorConnectorSettingsInput) {
    const settings = await connectorsApi.save(input);
    connectorsStore.update((current) => ({
      settings,
      defaultTools: current?.defaultTools ?? {},
    }));
    return settings;
  },
};
