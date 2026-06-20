import type { IconName } from "@/components/ui";
import type { DirectorBrief, DirectorScriptImage, DirectorLinkedAsset } from "@/lib/director/contract/brief";

/**
 * Pure builders that turn the brief into section "blocks" — the same content the
 * web References panel shows, minus React Flow. Each block is a card (icon +
 * label + preview) that expands to rendered markdown. Casting sheets are folded
 * into their entity sections exactly as on the web.
 */
const FIRST_URL = /(https?:\/\/[^\s)]+)/;
const EMBEDDED_REF = /\n*!\[Approved character reference\]\(https?:\/\/[^\s)]+\)\s*/gi;

function parseRef(value: string): { kind: string; url: string } | null {
  const url = value.match(FIRST_URL)?.[0];
  if (!url) return null;
  const kind = value.replace(url, "").replace(/[\s:—–-]+$/, "").trim().toLowerCase();
  return { kind, url };
}

function entityRecordToMarkdown(
  record: Record<string, string> | undefined,
  referenceImages: Record<string, string> | undefined,
  kind: "character" | "location" | "prop",
): string {
  const sheets = new Map<string, { url: string; name: string }>();
  for (const [name, value] of Object.entries(referenceImages ?? {})) {
    const parsed = parseRef(value);
    if (!parsed) continue;
    if (parsed.kind ? parsed.kind !== kind : kind !== "character") continue;
    sheets.set(name.toLocaleLowerCase(), { url: parsed.url, name });
  }
  const parts: string[] = [];
  for (const [name, description] of Object.entries(record ?? {})) {
    const sheet = sheets.get(name.toLocaleLowerCase());
    sheets.delete(name.toLocaleLowerCase());
    const clean = description.replace(EMBEDDED_REF, " ").trim();
    parts.push([`**${name}**`, sheet ? `![${name}](${sheet.url})` : "", clean].filter(Boolean).join("\n\n"));
  }
  for (const sheet of sheets.values()) parts.push(`**${sheet.name}**\n\n![${sheet.name}](${sheet.url})`);
  return parts.join("\n\n---\n\n");
}

function scriptImagesToMarkdown(images: DirectorScriptImage[]): string {
  return images
    .map((i) => [`**${i.scriptReference}**`, `![${i.scriptReference}](${i.url})`, i.prompt ? `_${i.prompt}_` : ""].filter(Boolean).join("\n\n"))
    .join("\n\n---\n\n");
}

function scriptWithFrames(script?: string, images?: DirectorScriptImage[]): string {
  const parts: string[] = [];
  if (script?.trim()) parts.push(script.trim());
  if (images?.length) parts.push(`## Keyframes\n\n${scriptImagesToMarkdown(images)}`);
  return parts.join("\n\n---\n\n");
}

function linkedAssetsToMarkdown(assets: DirectorLinkedAsset[]): string {
  return assets
    .map((a) => [a.isLogo ? `**${a.name}** · Logo` : `**${a.name}**`, `![${a.name}](${a.url})`, a.sourceUrl ? `[Source](${a.sourceUrl})` : ""].filter(Boolean).join("\n\n"))
    .join("\n\n---\n\n");
}

const listToMarkdown = (items: string[]) => items.map((i) => `- ${i}`).join("\n");

export function markdownPreview(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_`>[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type BriefGroupKey = "story" | "world" | "production" | "continuity";
export type BriefBlock = { key: string; label: string; md: string; preview: string; icon: IconName; group: BriefGroupKey };

export const GROUP_ORDER: BriefGroupKey[] = ["story", "world", "production", "continuity"];
export const GROUP_LABELS: Record<BriefGroupKey, string> = { story: "Story", world: "World", production: "Production", continuity: "Continuity" };

const LABELS: Record<string, string> = {
  logline: "Logline", creativeBrief: "Creative brief", script: "Script", productionPlan: "Production plan",
  characters: "Characters", locations: "Locations", props: "Props", linkedAssets: "Imported",
  visualLanguage: "Visual language", audio: "Audio", continuity: "Continuity", decisions: "Locked decisions",
  openQuestions: "Open questions", summary: "Summary",
};
const ICONS: Record<string, IconName> = {
  logline: "skills", creativeBrief: "notes", script: "document", productionPlan: "grid",
  characters: "characters", locations: "location", props: "prop", linkedAssets: "image",
  visualLanguage: "visual", audio: "audio", continuity: "continuity", decisions: "continuity",
  openQuestions: "question", summary: "document",
};
const GROUP_OF: Record<string, BriefGroupKey> = {
  logline: "story", creativeBrief: "story", script: "story", summary: "story",
  characters: "world", locations: "world", props: "world", linkedAssets: "world", visualLanguage: "world",
  productionPlan: "production", audio: "production",
  continuity: "continuity", decisions: "continuity", openQuestions: "continuity",
};

export function buildBriefBlocks(brief: DirectorBrief | null): BriefBlock[] {
  const s = brief?.sections;
  const blocks: BriefBlock[] = [];
  const add = (key: string, md?: string) => {
    if (!md?.trim()) return;
    blocks.push({ key, label: LABELS[key] ?? key, md, preview: markdownPreview(md) || "Open", icon: ICONS[key] ?? "document", group: GROUP_OF[key] ?? "story" });
  };
  add("logline", s?.logline);
  add("creativeBrief", s?.creativeBrief);
  add("script", scriptWithFrames(s?.script, s?.scriptImages));
  add("productionPlan", s?.productionPlan);
  add("characters", entityRecordToMarkdown(s?.characters, s?.referenceImages, "character"));
  add("locations", entityRecordToMarkdown(s?.locations, s?.referenceImages, "location"));
  add("props", entityRecordToMarkdown(s?.props, s?.referenceImages, "prop"));
  if (s?.linkedAssets?.length) add("linkedAssets", linkedAssetsToMarkdown(s.linkedAssets));
  add("visualLanguage", s?.visualLanguage);
  add("audio", s?.audio);
  add("continuity", s?.continuity);
  if (s?.decisions?.length) add("decisions", listToMarkdown(s.decisions));
  if (s?.openQuestions?.length) add("openQuestions", listToMarkdown(s.openQuestions));
  add("summary", brief?.summary);
  return blocks;
}
