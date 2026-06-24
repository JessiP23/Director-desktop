/**
 * Canvas2D backend of the editor renderer — the "always works" path of the
 * OpenReel-style progressive-enhancement renderer (WebGPU → Canvas2D fallback).
 *
 * It paints one {@link CompositeFrame} (produced by the pure planner in
 * ./frame-plan) onto any 2D context: the browser's `CanvasRenderingContext2D`
 * for the live preview, or `node-canvas` for a server-side export — same code,
 * so preview and export match. A WebGPU backend can be added later behind the
 * same plan; this module owns the actual drawing math (cover-fit, crop, text).
 *
 * The context is passed in via a minimal structural type, so this module stays
 * DOM-free (runs under Node) and is trivially unit-testable with a recording
 * mock.
 */

import {
  type CompositeFrame,
  type MediaCompositeLayer,
  type TextCompositeLayer,
} from "./frame-plan"

/** The subset of the Canvas 2D API the painter uses (browser + node-canvas). */
export interface Ctx2D {
  save(): void
  restore(): void
  fillRect(x: number, y: number, w: number, h: number): void
  drawImage(
    img: unknown,
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number, dw: number, dh: number,
  ): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
  translate(x: number, y: number): void
  scale(x: number, y: number): void
  globalAlpha: number
  fillStyle: string
  font: string
  textAlign: "left" | "right" | "center" | "start" | "end"
  textBaseline: "top" | "middle" | "bottom" | "alphabetic" | "hanging" | "ideographic"
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
}

/** A loaded drawable plus its intrinsic pixel size (so draw math is uniform). */
export type ResolvedSource = { source: unknown; width: number; height: number }

/** Resolves a media layer to its drawable source for the current frame (or null
 *  if not loaded yet — that layer is then skipped). */
export type SourceResolver = (layer: MediaCompositeLayer) => ResolvedSource | null

const FONT_FAMILY: Record<NonNullable<TextCompositeLayer["text"]["fontFamily"]>, string> = {
  sans: "sans-serif",
  serif: "serif",
  mono: "monospace",
}
const LINE_HEIGHT = 1.25

/** Source sub-rectangle (in source pixels) after applying the clip's crop. */
function cropRect(crop: MediaCompositeLayer["crop"], width: number, height: number) {
  const sx = (crop.left / 100) * width
  const sy = (crop.top / 100) * height
  const sw = Math.max(1, width - sx - (crop.right / 100) * width)
  const sh = Math.max(1, height - sy - (crop.bottom / 100) * height)
  return { sx, sy, sw, sh }
}

/**
 * Destination rectangle for a cropped source inside the frame: cover-fit the
 * frame (object-fit: cover, centered), then apply the clip's transform — extra
 * scale around the centre and an (x, y) pixel offset at sequence scale.
 */
function destRect(
  srcW: number, srcH: number,
  frameW: number, frameH: number,
  transform: MediaCompositeLayer["transform"],
) {
  const cover = Math.max(frameW / srcW, frameH / srcH)
  const w = srcW * cover * transform.scale
  const h = srcH * cover * transform.scale
  return {
    dx: (frameW - w) / 2 + transform.x,
    dy: (frameH - h) / 2 + transform.y,
    dw: w,
    dh: h,
  }
}

function drawMediaLayer(
  ctx: Ctx2D,
  layer: MediaCompositeLayer,
  frame: CompositeFrame,
  resolve: SourceResolver,
): void {
  const resolved = resolve(layer)
  if (!resolved) return
  const { sx, sy, sw, sh } = cropRect(layer.crop, resolved.width, resolved.height)
  const { dx, dy, dw, dh } = destRect(sw, sh, frame.width, frame.height, layer.transform)
  ctx.drawImage(resolved.source, sx, sy, sw, sh, dx, dy, dw, dh)
}

function fontString(text: TextCompositeLayer["text"]): string {
  const style = text.italic ? "italic " : ""
  const weight = text.fontWeight ?? 400
  const family = FONT_FAMILY[text.fontFamily ?? "sans"]
  return `${style}${weight} ${text.fontSize}px ${family}`
}

function drawTextLayer(ctx: Ctx2D, layer: TextCompositeLayer, frame: CompositeFrame): void {
  const { text } = layer
  ctx.font = fontString(text)
  ctx.fillStyle = text.color
  ctx.textAlign = text.textAlign ?? "center"
  ctx.textBaseline = "middle"
  if (text.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.55)"
    ctx.shadowBlur = Math.max(2, Math.round(text.fontSize * 0.08))
    ctx.shadowOffsetY = Math.max(1, Math.round(text.fontSize * 0.04))
  }

  const lines = text.text.split("\n")
  const lineHeight = text.fontSize * LINE_HEIGHT
  // Centre the text block in the frame, then apply the clip transform offset,
  // the rise-motion offset, and the entrance scale (around the block centre).
  const cx = frame.width / 2 + layer.transform.x
  const cy = frame.height / 2 + layer.transform.y + layer.riseOffsetPx
  const totalHeight = lines.length * lineHeight
  // Alignment with no explicit text box: justify multi-line around the centre.
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width), 0)
  const alignX = ctx.textAlign === "left" ? -widest / 2 : ctx.textAlign === "right" ? widest / 2 : 0

  ctx.translate(cx, cy)
  if (layer.motionScale !== 1) ctx.scale(layer.motionScale, layer.motionScale)
  lines.forEach((line, index) => {
    const y = -totalHeight / 2 + lineHeight / 2 + index * lineHeight
    ctx.fillText(line, alignX, y)
  })
}

/**
 * Paint a composite frame onto a 2D context. Layers are drawn back-to-front
 * (the planner already ordered media below text); each is isolated with
 * save/restore so transforms, alpha and shadow never leak between layers.
 */
export function drawCompositeFrame(ctx: Ctx2D, frame: CompositeFrame, resolve: SourceResolver): void {
  ctx.save()
  // Opaque black backdrop (gaps / letterboxing read black, like the preview).
  ctx.globalAlpha = 1
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, frame.width, frame.height)

  for (const layer of frame.layers) {
    ctx.save()
    ctx.globalAlpha = layer.opacity
    if (layer.kind === "text") drawTextLayer(ctx, layer, frame)
    else drawMediaLayer(ctx, layer, frame, resolve)
    ctx.restore()
  }
  ctx.restore()
}
