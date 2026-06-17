/*
 * ─────────────────────────────────────────────────────────────────────────
 *  DIRECTOR BRIEF CONTRACT — copied from wmstudio `src/lib/production-agent/brief-types.ts`.
 *  Keep in sync with the backend (see contract/director.ts header).
 * ─────────────────────────────────────────────────────────────────────────
 */

export type DirectorScriptImage = {
  scriptReference: string;
  url: string;
  prompt?: string;
};

export type DirectorScriptClip = {
  scriptReference: string;
  url: string;
  prompt?: string;
};

/** An image imported from a user-shared link, approved as reusable reference. */
export type DirectorLinkedAsset = {
  url: string;
  name: string;
  sourceUrl: string;
  isLogo?: boolean;
};

export type DirectorBriefSections = {
  logline?: string;
  creativeBrief?: string;
  script?: string;
  scriptImages?: DirectorScriptImage[];
  scriptClips?: DirectorScriptClip[];
  productionPlan?: string;
  characters?: Record<string, string>;
  locations?: Record<string, string>;
  props?: Record<string, string>;
  /** Entity name → "<kind>: <url>" casting-sheet reference. */
  referenceImages?: Record<string, string>;
  /** Images imported from user-shared links, approved as reusable references. */
  linkedAssets?: DirectorLinkedAsset[];
  visualLanguage?: string;
  audio?: string;
  continuity?: string;
  decisions?: string[];
  openQuestions?: string[];
};

export type DirectorBrief = {
  runId: string;
  userId: string;
  version: number;
  sections: DirectorBriefSections;
  summary?: string;
  createdAt: string;
  updatedAt: string;
};

/** Payload accepted by the PATCH brief endpoint. */
export type DirectorBriefPatchPayload = {
  sections?: Partial<DirectorBriefSections>;
  removeScriptImageUrls?: string[];
  removeScriptClipUrls?: string[];
  summary?: string;
  reason?: string;
  /** If provided and stale, the update is rejected (optimistic concurrency). */
  expectedVersion?: number;
};

export const DIRECTOR_BRIEF_SECTION_KEYS = [
  "logline",
  "creativeBrief",
  "script",
  "scriptImages",
  "scriptClips",
  "productionPlan",
  "characters",
  "locations",
  "props",
  "referenceImages",
  "visualLanguage",
  "audio",
  "continuity",
  "decisions",
  "openQuestions",
] as const;

export type DirectorBriefSectionKey = (typeof DIRECTOR_BRIEF_SECTION_KEYS)[number];
