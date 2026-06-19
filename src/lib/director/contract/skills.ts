/**
 * Director skills contract — mirrors the backend's
 * `src/lib/production-agent/skills/types.ts`. The desktop manages skills through
 * the `/api/production-agent/skills` routes, so the shape must stay identical.
 */

export const DIRECTOR_SKILL_TYPES = ["tool_chain", "prompt_template", "hybrid"] as const;

export type DirectorSkillType = (typeof DIRECTOR_SKILL_TYPES)[number];

export const DIRECTOR_SKILL_CATEGORIES = [
  "creative",
  "analysis",
  "research",
  "planning",
  "automation",
  "custom",
] as const;

export type DirectorSkillCategory = (typeof DIRECTOR_SKILL_CATEGORIES)[number];

/**
 * How an enabled skill reaches the Director:
 * - `always_on`: injected into the system prompt every turn.
 * - `on_demand`: seeded as a `SKILL.md` and discovered via progressive
 *   disclosure — only its name + description sit in context until the model
 *   decides to read it.
 */
export const DIRECTOR_SKILL_ACTIVATIONS = ["always_on", "on_demand"] as const;

export type DirectorSkillActivation = (typeof DIRECTOR_SKILL_ACTIVATIONS)[number];

export type DirectorSkill = {
  id: string;
  userId: string;
  name: string;
  /** Agent-Skills-spec slug; derived from `name` when absent. */
  slug?: string;
  description: string;
  skillType: DirectorSkillType;
  category: DirectorSkillCategory;
  /** Defaults to `always_on` when absent (pre-migration rows). */
  activation?: DirectorSkillActivation;
  systemPrompt?: string;
  toolPattern?: string[];
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateDirectorSkillInput = {
  name: string;
  slug?: string;
  description: string;
  skillType: DirectorSkillType;
  category: DirectorSkillCategory;
  activation?: DirectorSkillActivation;
  systemPrompt?: string;
  toolPattern?: string[];
  metadata?: Record<string, unknown>;
};

export type UpdateDirectorSkillInput = {
  name?: string;
  description?: string;
  skillType?: DirectorSkillType;
  category?: DirectorSkillCategory;
  activation?: DirectorSkillActivation;
  systemPrompt?: string;
  toolPattern?: string[];
  enabled?: boolean;
  metadata?: Record<string, unknown>;
};

export const DIRECTOR_SKILL_NAME_MAX = 120;
export const DIRECTOR_SKILL_DESCRIPTION_MAX = 500;
export const DIRECTOR_SKILL_SYSTEM_PROMPT_MAX = 5000;
