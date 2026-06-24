/**
 * Thumbnail Extraction Queue
 *
 * Throttles concurrent video thumbnail extractions to avoid overwhelming
 * the browser with too many simultaneous `<video>` element loads.
 *
 * When a gallery has 50+ videos visible, without throttling the browser
 * tries to load all of them at once — saturating the network, consuming
 * memory for decoded video frames, and causing jank.
 *
 * This queue limits concurrency to MAX_CONCURRENT extractions. Each
 * card calls `enqueueThumbnailExtraction()` instead of creating its own
 * video element directly. The queue processes items FIFO, ensuring the
 * topmost visible cards get their thumbnails first.
 *
 * Works as a singleton — shared across all RawGenerationCard instances.
 */

type ThumbnailResult = {
  dataUrl: string | null  // null = CORS fallback (no canvas extraction)
  success: boolean        // false = video failed to load entirely
}

type QueueItem = {
  videoUrl: string
  resolve: (result: ThumbnailResult) => void
  abortController: AbortController
}

const MAX_CONCURRENT = 3
let running = 0
const queue: QueueItem[] = []

function processNext() {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift()!

    // Skip if already aborted (component unmounted)
    if (item.abortController.signal.aborted) {
      item.resolve({ dataUrl: null, success: false })
      continue
    }

    running++
    extractThumbnail(item.videoUrl, item.abortController.signal)
      .then(item.resolve)
      .catch(() => item.resolve({ dataUrl: null, success: false }))
      .finally(() => {
        running--
        processNext()
      })
  }
}

function extractThumbnail(
  videoUrl: string,
  signal: AbortSignal,
): Promise<ThumbnailResult> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve({ dataUrl: null, success: false })
      return
    }

    const vid = document.createElement("video")
    vid.crossOrigin = "anonymous"
    vid.preload = "metadata"
    vid.muted = true
    vid.playsInline = true

    const cleanup = () => {
      vid.removeAttribute("src")
      vid.load()
    }

    const onAbort = () => {
      cleanup()
      resolve({ dataUrl: null, success: false })
    }

    signal.addEventListener("abort", onAbort, { once: true })

    vid.addEventListener(
      "loadeddata",
      () => {
        if (signal.aborted) return
        vid.currentTime = 0.1
      },
      { once: true },
    )

    vid.addEventListener(
      "seeked",
      () => {
        if (signal.aborted) return
        try {
          const canvas = document.createElement("canvas")
          canvas.width = vid.videoWidth
          canvas.height = vid.videoHeight
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7)
            cleanup()
            signal.removeEventListener("abort", onAbort)
            resolve({ dataUrl, success: true })
            return
          }
        } catch {
          // CORS-tainted canvas — fall back to showing paused video
        }
        cleanup()
        signal.removeEventListener("abort", onAbort)
        resolve({ dataUrl: null, success: true })
      },
      { once: true },
    )

    vid.addEventListener(
      "error",
      () => {
        if (signal.aborted) return
        cleanup()
        signal.removeEventListener("abort", onAbort)
        resolve({ dataUrl: null, success: false })
      },
      { once: true },
    )

    vid.src = videoUrl
    vid.load()
  })
}

/**
 * Enqueue a video URL for thumbnail extraction.
 *
 * Returns a promise that resolves with:
 * - `{ dataUrl: "data:...", success: true }` — canvas extraction worked
 * - `{ dataUrl: null, success: true }` — video loaded but CORS blocked canvas
 * - `{ dataUrl: null, success: false }` — video failed or was aborted
 *
 * Call `abortController.abort()` on unmount to cancel.
 */
export function enqueueThumbnailExtraction(
  videoUrl: string,
  abortController: AbortController,
): Promise<ThumbnailResult> {
  return new Promise((resolve) => {
    queue.push({ videoUrl, resolve, abortController })
    processNext()
  })
}
