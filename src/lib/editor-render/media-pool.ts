/**
 * Browser media pool for the editor renderer: loads and caches the
 * HTMLVideoElement / HTMLImageElement behind each timeline media URL, and hands
 * the Canvas2D/WebGPU painter a drawable source for any layer.
 *
 * Browser-only (touches the DOM); instantiate it from a client component. The
 * pure planner (frame-plan) and painter (draw) stay environment-agnostic — this
 * is the thin DOM adapter that feeds them real pixels.
 */

import type { MediaCompositeLayer } from "@/lib/editor/render/frame-plan"
import type { ResolvedSource } from "@/lib/editor/render/draw"

export type MediaSpec = { url: string; kind: "video" | "image" }

type VideoEntry = { kind: "video"; el: HTMLVideoElement; ready: boolean }
type ImageEntry = { kind: "image"; el: HTMLImageElement; ready: boolean }
type Entry = VideoEntry | ImageEntry

export class MediaPool {
  private readonly entries = new Map<string, Entry>()
  private readonly crossOrigin: boolean

  /** crossOrigin: leave false for on-screen preview (works without R2 CORS,
   *  taints the canvas); set true for export readback (requires R2 CORS). */
  constructor(opts: { crossOrigin?: boolean } = {}) {
    this.crossOrigin = opts.crossOrigin ?? false
  }

  /** Load every distinct media URL. Resolves when all have settled (ok or error). */
  async preload(specs: MediaSpec[]): Promise<void> {
    const seen = new Set<string>()
    const unique = specs.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
    await Promise.all(unique.map((s) => this.loadOne(s)))
  }

  private loadOne(spec: MediaSpec): Promise<void> {
    if (this.entries.has(spec.url)) return Promise.resolve()
    return spec.kind === "video" ? this.loadVideo(spec.url) : this.loadImage(spec.url)
  }

  private loadVideo(url: string): Promise<void> {
    return new Promise((resolve) => {
      const el = document.createElement("video")
      el.muted = true
      el.playsInline = true
      el.preload = "auto"
      if (this.crossOrigin) el.crossOrigin = "anonymous"
      const entry: VideoEntry = { kind: "video", el, ready: false }
      this.entries.set(url, entry)
      el.addEventListener("loadeddata", () => { entry.ready = el.videoWidth > 0; resolve() }, { once: true })
      el.addEventListener("error", () => resolve(), { once: true })
      el.src = url
      el.load()
    })
  }

  private loadImage(url: string): Promise<void> {
    const el = new Image()
    if (this.crossOrigin) el.crossOrigin = "anonymous"
    const entry: ImageEntry = { kind: "image", el, ready: false }
    this.entries.set(url, entry)
    el.src = url
    // `decode()` resolves only once the bitmap is fully decoded and ready to
    // paint — unlike the `load` event, which fires when the bytes are merely
    // *fetched*. Drawing a fetched-but-undecoded image in the exporter's tight
    // synchronous encode loop paints nothing, so the whole clip comes out black
    // (the preview survives because it draws across rAF frames, giving the decode
    // time to land). Decoding up front during preload guarantees every frame has
    // a paintable bitmap. On failure (broken/undecodable source) the entry simply
    // stays not-ready and contributes nothing — same graceful behaviour as before.
    return el.decode().then(
      () => { entry.ready = el.naturalWidth > 0 },
      () => { /* unsupported / failed to load → not ready */ },
    )
  }

  /** Drawable source for a media layer, or null if it is not loaded yet. */
  resolve(layer: MediaCompositeLayer): ResolvedSource | null {
    const entry = this.entries.get(layer.url)
    if (!entry || !entry.ready) return null
    return entry.kind === "video"
      ? { source: entry.el, width: entry.el.videoWidth, height: entry.el.videoHeight }
      : { source: entry.el, width: entry.el.naturalWidth, height: entry.el.naturalHeight }
  }

  video(url: string): HTMLVideoElement | null {
    const entry = this.entries.get(url)
    return entry?.kind === "video" ? entry.el : null
  }

  /** Readiness snapshot of every entry — for export diagnostics. */
  debugStatus(): { url: string; kind: "video" | "image"; ready: boolean; width: number; height: number }[] {
    return [...this.entries.entries()].map(([url, e]) => ({
      url,
      kind: e.kind,
      ready: e.ready,
      width: e.kind === "video" ? e.el.videoWidth : e.el.naturalWidth,
      height: e.kind === "video" ? e.el.videoHeight : e.el.naturalHeight,
    }))
  }

  forEachVideo(callback: (el: HTMLVideoElement) => void): void {
    for (const entry of this.entries.values()) if (entry.kind === "video") callback(entry.el)
  }

  pauseAll(): void {
    this.forEachVideo((el) => el.pause())
  }

  destroy(): void {
    this.forEachVideo((el) => { el.pause(); el.removeAttribute("src"); el.load() })
    this.entries.clear()
  }
}
