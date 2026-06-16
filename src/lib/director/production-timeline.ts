/*
 * Production timeline helpers — copied from wmstudio
 * `src/app/[locale]/dashboard/director/lib/production-timeline.ts`.
 *
 * The production timeline is the brief's user-confirmed clips (`scriptClips`)
 * in screenplay scene/shot order. Keep the ordering identical to the backend's.
 */

/** A confirmed clip in the production timeline (from the brief's scriptClips). */
export type ConfirmedClip = { url: string; scriptReference: string };

/** Natural scene/shot ordering so "Scene 10 / Shot 1" sorts after "Scene 2 / Shot 3". */
export function compareScriptReference(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
