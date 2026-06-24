/**
 * Client-side timeline export: renders the canonical timeline to an MP4 entirely
 * in the browser, reusing the SAME planner + Canvas2D painter as the preview, so
 * the exported file matches what the user sees.
 *
 * Each frame is composed deterministically (visible videos are seeked to their
 * exact source time and the seek is awaited before capture), the offscreen
 * canvas is fed to MediaBunny's WebCodecs encoder, and the muxed MP4 bytes are
 * returned as a Blob. Media is loaded through the same-origin proxy so the
 * canvas stays readable (no R2 CORS needed).
 */

import { composeFrame } from "@/lib/editor/render/frame-plan"
import { planTimelineAudio } from "@/lib/editor/render/audio-plan"
import { drawCompositeFrame, type Ctx2D } from "@/lib/editor/render/draw"
import {
  type MediaRef,
  type Timeline,
  timelineDurationFrames,
} from "@/lib/editor/timeline-model"
import { MediaPool, type MediaSpec } from "./media-pool"
import { config } from "@/lib/config"

/** Flip to false to silence the per-export diagnostics in the browser console. */
const DEBUG_EXPORT = true

/**
 * Probe every (proxied) source through the proxy and report each pool entry's
 * readiness + a frame-0 layer breakdown. Tells you exactly where a black export
 * fails: a non-200/non-image proxy status, a not-ready/0×0 pool entry, a frame
 * with no layers, or a layer that won't resolve. Logs to the BROWSER console.
 */
async function logExportDiagnostics(proxied: Timeline, pool: MediaPool, total: number): Promise<void> {
  const { width, height, fps } = proxied.sequence
  console.info(
    `[export] ${total} frames @ ${fps}fps ${width}×${height} · ${Object.keys(proxied.media).length} media · ${Object.keys(proxied.clips).length} clips`,
  )
  for (const m of Object.values(proxied.media)) {
    try {
      const res = await fetch(m.url, { headers: { Range: "bytes=0-0" } })
      console.info(`[export] probe ${m.kind} → ${res.status} ${res.headers.get("content-type") ?? "?"} (${m.url})`)
    } catch (err) {
      console.warn(`[export] probe ${m.kind} FAILED (${m.url})`, err)
    }
  }
  console.info("[export] pool ready:", pool.debugStatus())
  const plan0 = composeFrame(proxied, 0)
  console.info(
    `[export] frame 0 → ${plan0.layers.length} layer(s):`,
    plan0.layers.map((l) => ({
      kind: l.kind,
      clipId: l.clipId,
      url: "url" in l ? l.url : undefined,
      resolved: l.kind === "text" ? "n/a" : Boolean(pool.resolve(l)),
    })),
  )
}

export type ExportProgress = { frame: number; total: number }
export type ExportOptions = {
  onProgress?: (progress: ExportProgress) => void
  /** Target video bitrate in bits/s (default 6 Mbps). */
  bitrate?: number
  signal?: AbortSignal
}

/** Route a media URL through the backend proxy (keeps the canvas readable for
 *  WebCodecs readback). Desktop has no same-origin server, so prefix the backend
 *  origin; the proxy route's CORS (middleware) allows the desktop origin. */
function proxiedUrl(url: string): string {
  return `${config.apiBaseUrl}/api/editor/media-proxy?url=${encodeURIComponent(url)}`
}

/** A copy of the timeline whose media URLs point at the same-origin proxy. */
function withProxiedMedia(timeline: Timeline): Timeline {
  const media: Record<string, MediaRef> = {}
  for (const [id, ref] of Object.entries(timeline.media)) {
    media[id] = { ...ref, url: proxiedUrl(ref.url) }
  }
  return { ...timeline, media }
}

/** Seek a video to `timeSeconds` and resolve once the frame has landed. */
function seekVideo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  if (Math.abs(video.currentTime - timeSeconds) < 1e-3) return Promise.resolve()
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      resolve()
    }
    video.addEventListener("seeked", onSeeked)
    video.currentTime = timeSeconds
  })
}

async function renderExportFrame(ctx: Ctx2D, timeline: Timeline, frame: number, pool: MediaPool): Promise<void> {
  const plan = composeFrame(timeline, frame)
  await Promise.all(
    plan.layers
      .filter((layer) => layer.kind !== "text")
      .map((layer) => {
        const video = pool.video(layer.url)
        // Only videos need a seek; images are static.
        return video && "sourceFrame" in layer ? seekVideo(video, layer.sourceFrame / plan.fps) : Promise.resolve()
      }),
  )
  drawCompositeFrame(ctx, plan, (layer) => pool.resolve(layer))
}

/**
 * Render the timeline's audio to a single mixed AudioBuffer via the planner + an
 * OfflineAudioContext (which places each segment at its timeline offset, trims it
 * to its span, and sums overlaps natively). Returns null when there's no audio.
 * Sources are the already-proxied URLs, so decoding is same-origin / CORS-free.
 */
async function renderTimelineAudio(
  timeline: Timeline,
  totalSeconds: number,
  signal?: AbortSignal,
): Promise<AudioBuffer | null> {
  const segments = planTimelineAudio(timeline)
  if (segments.length === 0 || totalSeconds <= 0) return null

  const sampleRate = 48000
  const length = Math.max(1, Math.ceil(totalSeconds * sampleRate))
  const ctx = new OfflineAudioContext(2, length, sampleRate)

  // Decode each distinct source once. A source with no decodable audio track
  // (e.g. a silent clip) is skipped and simply contributes silence.
  const urls = [...new Set(segments.map((s) => s.url))]
  const buffers = new Map<string, AudioBuffer>()
  await Promise.all(
    urls.map(async (url) => {
      if (signal?.aborted) return
      try {
        const res = await fetch(url, { signal })
        buffers.set(url, await ctx.decodeAudioData(await res.arrayBuffer()))
      } catch {
        // unsupported / no audio track → silence for this source
      }
    }),
  )
  if (signal?.aborted) throw new DOMException("Export aborted", "AbortError")
  if (buffers.size === 0) return null

  for (const seg of segments) {
    const buffer = buffers.get(seg.url)
    if (!buffer) continue
    const offset = Math.min(seg.sourceStartSec, Math.max(0, buffer.duration - 1e-3))
    const duration = Math.max(0, Math.min(seg.durationSec, buffer.duration - offset))
    if (duration <= 0) continue
    const node = ctx.createBufferSource()
    node.buffer = buffer
    node.connect(ctx.destination)
    // start(when, offset, duration): WebAudio handles placement + trim; overlaps sum.
    node.start(seg.timelineStartSec, offset, duration)
  }

  return await ctx.startRendering()
}

/**
 * Render the whole timeline to an MP4 Blob. Runs in the browser; progress is
 * reported per frame. Throws if aborted via `options.signal`.
 */
export async function exportTimelineToMp4(timeline: Timeline, options: ExportOptions = {}): Promise<Blob> {
  // Lazy-load the WebCodecs encoder only in the browser at export time — keeps it
  // out of SSR and the initial page bundle.
  const { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output } = await import("mediabunny")
  const proxied = withProxiedMedia(timeline)
  const { width, height, fps } = proxied.sequence
  const total = Math.max(1, timelineDurationFrames(proxied))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d") as unknown as Ctx2D

  const pool = new MediaPool()
  const specs: MediaSpec[] = Object.values(proxied.media).map((m) => ({
    url: m.url,
    kind: m.kind === "image" ? "image" : "video",
  }))
  await pool.preload(specs)
  if (DEBUG_EXPORT) await logExportDiagnostics(proxied, pool, total)

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec: "avc", bitrate: options.bitrate ?? 6e6 })
  output.addVideoTrack(source, { frameRate: fps })

  // Mix the timeline audio up front (decode + place + sum). Add the track BEFORE
  // start() if there's any audio; the mixed buffer is muxed after the frame loop.
  const audioBuffer = await renderTimelineAudio(proxied, total / fps, options.signal)
  let audioSource: InstanceType<typeof AudioBufferSource> | null = null
  if (audioBuffer) {
    audioSource = new AudioBufferSource({ codec: "aac", bitrate: 128_000 })
    output.addAudioTrack(audioSource)
  }

  try {
    await output.start()
    for (let frame = 0; frame < total; frame += 1) {
      if (options.signal?.aborted) throw new DOMException("Export aborted", "AbortError")
      await renderExportFrame(ctx, proxied, frame, pool)
      await source.add(frame / fps, 1 / fps)
      options.onProgress?.({ frame: frame + 1, total })
    }
    if (audioSource && audioBuffer) await audioSource.add(audioBuffer)
    await output.finalize()
    const buffer = output.target.buffer
    if (!buffer) throw new Error("Export produced no output")
    return new Blob([buffer], { type: "video/mp4" })
  } finally {
    pool.destroy()
  }
}
