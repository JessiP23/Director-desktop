/**
 * Defers state synchronization started by an effect until after the current
 * commit. This keeps React Compiler happy at hydration/restore boundaries while
 * still making the cancellation path explicit when inputs change quickly.
 */
export function scheduleEffectStateSync(task: () => void): () => void {
  let cancelled = false
  queueMicrotask(() => {
    if (!cancelled) task()
  })
  return () => {
    cancelled = true
  }
}
