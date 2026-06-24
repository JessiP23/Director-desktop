/**
 * Browser timeline player: drives the Canvas2D painter from the pure planner,
 * with real video frames from the MediaPool. This is the live-preview runtime —
 * the same composition that the exporter will replay frame-by-frame, so preview
 * and export match.
 *
 * Playback drives a master clock (currentFrame); visible videos are played and
 * drift-corrected against their target source time, off-screen videos paused.
 * Scrubbing seeks each visible video precisely and redraws on `seeked`.
 *
 * Browser-only. A WebGPU backend can later replace `drawCompositeFrame` here
 * behind the same plan.
 */

import { composeFrame } from "@/lib/editor/render/frame-plan"
import { drawCompositeFrame, type Ctx2D } from "@/lib/editor/render/draw"
import { type Timeline, timelineDurationFrames } from "@/lib/editor/timeline-model"
import { MediaPool, type MediaSpec } from "./media-pool"

/** Throttle for React state updates during playback (ms). The canvas still
 *  draws every rAF; only the UI (slider/counter) is rate-limited to avoid a
 *  re-render on every frame. */
const STATE_EMIT_INTERVAL_MS = 120

/** How early (seconds) to start playing the next clip off-screen so it is at
 *  speed by the cut, hiding the play() ramp-up that otherwise freezes the first
 *  frames. Tunable: larger hides more latency but skips more head on clips that
 *  have no pre-entry runway. */
const PREROLL_SECONDS = 0.15

/** Cap the preview canvas backing store to this long edge (px). The composition
 *  is drawn in sequence-pixel space (e.g. 1080×1920) but only ever shown small,
 *  so painting at full res ~60×/s is what makes playback choppy on weak GPUs.
 *  Scaling the backing store down cuts per-frame cost by ~scale². Export is
 *  unaffected (it uses its own full-res canvas). Tunable: lower = smoother but
 *  softer preview. */
const MAX_PREVIEW_EDGE = 720

/** A look-ahead decision for one upcoming video. Pure data so the timing/runway
 *  math is unit-tested without the DOM (see player-preroll.test.ts). */
export type PrerollAction = { url: string; play: boolean; seekTo: number }

/**
 * For each upcoming video clip in the look-ahead window, decide how to warm it
 * so the cut is seamless:
 *  - within ~1s of the cut: keep the decoder warm at the entry frame (play:false).
 *  - within `prerollSeconds` of the cut: start playing it off-screen (play:true),
 *    seeked so that — using the clip's own pre-entry source as runway — it lands
 *    on the entry frame exactly at the cut. With no runway it starts at 0 (a few
 *    head frames are skipped, still better than a visible freeze).
 * Urls already on screen are skipped (the main loop owns those).
 */
export function planPreroll(
  timeline: Timeline,
  currentFrame: number,
  onScreenUrls: Set<string>,
  prerollSeconds: number = PREROLL_SECONDS,
): PrerollAction[] {
  const fps = timeline.sequence.fps
  const horizon = currentFrame + fps
  const prerollFrames = Math.max(1, Math.round(prerollSeconds * fps))
  const actions: PrerollAction[] = []
  const seen = new Set<string>()
  for (const clip of Object.values(timeline.clips)) {
    if (clip.kind !== "video" || clip.mediaId === null) continue
    if (clip.startFrame <= currentFrame || clip.startFrame > horizon) continue
    const media = timeline.media[clip.mediaId]
    if (!media || onScreenUrls.has(media.url) || seen.has(media.url)) continue
    seen.add(media.url)
    const entrySeconds = clip.trimStartFrame / fps
    const framesToCut = clip.startFrame - currentFrame
    if (framesToCut <= prerollFrames) {
      const runwaySeconds = Math.min(framesToCut / fps, entrySeconds)
      actions.push({ url: media.url, play: true, seekTo: Math.max(0, entrySeconds - runwaySeconds) })
    } else {
      actions.push({ url: media.url, play: false, seekTo: entrySeconds })
    }
  }
  return actions
}

export type PlayerState = { frame: number; total: number; playing: boolean }

export class TimelinePlayer {
  private readonly ctx: Ctx2D
  private readonly canvas: HTMLCanvasElement
  private readonly pool: MediaPool
  private timeline: Timeline
  private rafId = 0
  private playing = false
  private currentFrame = 0
  private clockStartMs = 0
  private frameAtStart = 0
  private lastEmitMs = 0
  /** Backing-store px per sequence px (≤ 1). The painter works in sequence
   *  coordinates; this scales them into the (capped) preview canvas. */
  private previewScale = 1
  /** Urls whose timed pre-roll play() has been issued for the current approach,
   *  so we don't re-seek/replay them every frame (that would reset the runway). */
  private readonly prerolled = new Set<string>()

  /** Notified on render (rate-limited during playback; wire to React state). */
  onState?: (state: PlayerState) => void

  constructor(canvas: HTMLCanvasElement, timeline: Timeline, opts: { crossOrigin?: boolean } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d") as unknown as Ctx2D
    this.timeline = timeline
    this.pool = new MediaPool({ crossOrigin: opts.crossOrigin })
    this.sizeCanvas(timeline.sequence)
  }

  /** Size the backing store to the sequence aspect, capped to MAX_PREVIEW_EDGE,
   *  and record the scale the painter must apply. */
  private sizeCanvas(seq: { width: number; height: number }): void {
    this.previewScale = Math.min(1, MAX_PREVIEW_EDGE / Math.max(seq.width, seq.height))
    const w = Math.max(1, Math.round(seq.width * this.previewScale))
    const h = Math.max(1, Math.round(seq.height * this.previewScale))
    if (this.canvas.width !== w) this.canvas.width = w
    if (this.canvas.height !== h) this.canvas.height = h
  }

  /** Reset the context to the preview scale before painting a frame, so the
   *  sequence-pixel draw math lands inside the capped backing store. setTransform
   *  is absolute, so this never compounds across frames. */
  private beginFrame(): void {
    ;(this.ctx as unknown as CanvasRenderingContext2D).setTransform(
      this.previewScale, 0, 0, this.previewScale, 0, 0,
    )
  }

  get total(): number {
    return Math.max(1, timelineDurationFrames(this.timeline))
  }

  private mediaSpecs(): MediaSpec[] {
    return Object.values(this.timeline.media).map((m) => ({
      url: m.url,
      kind: m.kind === "image" ? "image" : "video",
    }))
  }

  // A landed scrub seek updates the video asynchronously — redraw when it does.
  // `onseeked` (not addEventListener) keeps this idempotent across timeline edits.
  private wireSeekRedraw(): void {
    this.pool.forEachVideo((el) => {
      el.onseeked = () => { if (!this.playing) this.draw() }
    })
  }

  async load(): Promise<void> {
    await this.pool.preload(this.mediaSpecs())
    this.wireSeekRedraw()
    this.draw()
  }

  /**
   * Swap in an edited timeline without rebuilding the player: load any newly
   * referenced media (the pool skips already-loaded urls), resize the canvas if
   * the sequence changed, clamp the playhead, and repaint the current frame.
   * This is what lets the canvas drive a LIVE editing preview, not just static
   * playback — every manual/agent edit calls it and the frame repaints cheaply.
   */
  async updateTimeline(next: Timeline): Promise<void> {
    this.timeline = next
    this.sizeCanvas(next.sequence)
    await this.pool.preload(this.mediaSpecs())
    this.wireSeekRedraw()
    if (this.currentFrame > this.total) this.currentFrame = this.total
    if (!this.playing) this.draw()
  }

  private emit(): void {
    // Rate-limit React updates during playback; the canvas itself is unthrottled.
    if (this.playing) {
      const now = performance.now()
      if (now - this.lastEmitMs < STATE_EMIT_INTERVAL_MS) return
      this.lastEmitMs = now
    }
    this.onState?.({ frame: this.currentFrame, total: this.total, playing: this.playing })
  }

  private draw(): void {
    const plan = composeFrame(this.timeline, this.currentFrame)
    this.beginFrame()
    drawCompositeFrame(this.ctx, plan, (layer) => this.pool.resolve(layer))
    this.emit()
  }

  seek(frame: number): void {
    this.pause()
    this.currentFrame = Math.max(0, Math.min(this.total, Math.round(frame)))
    const plan = composeFrame(this.timeline, this.currentFrame)
    for (const layer of plan.layers) {
      if (layer.kind === "text") continue
      const video = this.pool.video(layer.url)
      if (video) video.currentTime = layer.sourceFrame / plan.fps
    }
    this.draw() // immediate; the `seeked` listener redraws once the frame lands
  }

  play(): void {
    if (this.playing) return
    if (this.currentFrame >= this.total) this.currentFrame = 0
    this.playing = true
    this.prerolled.clear()
    this.clockStartMs = performance.now()
    this.frameAtStart = this.currentFrame

    const tick = () => {
      if (!this.playing) return
      const elapsedS = (performance.now() - this.clockStartMs) / 1000
      this.currentFrame = this.frameAtStart + Math.round(elapsedS * this.timeline.sequence.fps)
      if (this.currentFrame >= this.total) {
        this.currentFrame = this.total
        this.playing = false
        this.pool.pauseAll()
        this.draw()
        return
      }
      this.syncAndDrawPlayback()
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private syncAndDrawPlayback(): void {
    const plan = composeFrame(this.timeline, this.currentFrame)
    const onScreen = new Set<string>()
    for (const layer of plan.layers) {
      if (layer.kind === "text") continue
      onScreen.add(layer.url)
      const video = this.pool.video(layer.url)
      if (!video) continue
      // A clip the pre-roll already started is playing (not paused) — leave it
      // rolling and never re-seek; mid-play re-seeking is what stutters. Only a
      // cold clip (the first one, or one with no look-ahead) seeks + plays here.
      if (video.paused) {
        video.currentTime = layer.sourceFrame / plan.fps
        void video.play().catch(() => {})
      }
    }

    // Warm / pre-roll the upcoming clips so the next cut is seamless.
    const keepPlaying = new Set<string>()
    for (const action of planPreroll(this.timeline, this.currentFrame, onScreen)) {
      const video = this.pool.video(action.url)
      if (!video) continue
      if (action.play) {
        keepPlaying.add(action.url)
        // Start it once, on the runway-seeked position; later frames leave it be.
        if (!this.prerolled.has(action.url)) {
          this.prerolled.add(action.url)
          video.currentTime = action.seekTo
          void video.play().catch(() => {})
        }
      } else if (video.paused && Math.abs(video.currentTime - action.seekTo) > 0.05) {
        video.currentTime = action.seekTo
      }
    }

    // Pause anything neither on-screen nor pre-rolling, and forget its pre-roll.
    for (const media of Object.values(this.timeline.media)) {
      if (media.kind !== "video") continue
      if (onScreen.has(media.url) || keepPlaying.has(media.url)) continue
      this.pool.video(media.url)?.pause()
      this.prerolled.delete(media.url)
    }

    this.beginFrame()
    drawCompositeFrame(this.ctx, plan, (layer) => this.pool.resolve(layer))
    this.emit()
  }

  pause(): void {
    this.playing = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
    this.pool.pauseAll()
    this.prerolled.clear()
    this.emit()
  }

  destroy(): void {
    this.pause()
    this.pool.destroy()
  }
}
