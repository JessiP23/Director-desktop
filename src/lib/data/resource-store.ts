/**
 * A tiny, generic cached-resource layer.
 *
 * The problem it solves: user-scoped lists (memories, skills, connector tools)
 * are read all over the UI and were previously easy to refetch on every render
 * or every agent output. That cost grows with the number of tools/memories and
 * makes each interaction feel slow.
 *
 * The model here is fetch-once-and-share with stale-while-revalidate:
 *   - the first reader triggers exactly one network load (concurrent readers
 *     dedupe onto the same in-flight promise),
 *   - the resolved value is cached in memory and handed to every subsequent
 *     reader synchronously (O(1), no request),
 *   - mutations update the cache optimistically and notify subscribers, so the
 *     UI never waits on a re-list to reflect a change,
 *   - `invalidate()` forces the next read to revalidate.
 *
 * Performance is therefore constant regardless of how many components read a
 * resource or how large the list grows — there is one store per resource and
 * one request per (cold) load, not one per consumer or per output.
 */
import * as React from "react";

type Listener = () => void;

export type ResourceSnapshot<T> = {
  /** Cached value, or `undefined` until the first load resolves. */
  data: T | undefined;
  /** True while a (re)load is in flight. */
  loading: boolean;
  /** Last load error, cleared on the next successful load. */
  error: string | null;
};

export type ResourceStore<T> = {
  /** Subscribe to snapshot changes (used by `useResource`). */
  subscribe: (listener: Listener) => () => void;
  /** Current snapshot — stable reference until something changes. */
  getSnapshot: () => ResourceSnapshot<T>;
  /** Ensure the value is loaded; dedupes concurrent and repeat calls. */
  ensureLoaded: () => Promise<T>;
  /** Force a revalidation on the next read and trigger one now if observed. */
  invalidate: () => void;
  /** Replace the cached value (e.g. after a mutation) and notify. */
  set: (next: T) => void;
  /** Derive the next value from the current one (optimistic mutations). */
  update: (recipe: (current: T | undefined) => T) => void;
};

/**
 * Create a store for a single resource fetched by `loader`. One module-level
 * store per resource is the intended usage (see `library-stores.ts`).
 */
export function createResourceStore<T>(loader: () => Promise<T>): ResourceStore<T> {
  let snapshot: ResourceSnapshot<T> = { data: undefined, loading: false, error: null };
  let inFlight: Promise<T> | null = null;
  let loadedOnce = false;
  const listeners = new Set<Listener>();

  function emit(next: Partial<ResourceSnapshot<T>>) {
    snapshot = { ...snapshot, ...next };
    for (const listener of listeners) listener();
  }

  async function load(): Promise<T> {
    // Dedupe: every caller awaits the same in-flight request.
    if (inFlight) return inFlight;
    emit({ loading: true, error: null });
    inFlight = loader()
      .then((data) => {
        loadedOnce = true;
        emit({ data, loading: false, error: null });
        return data;
      })
      .catch((err) => {
        emit({ loading: false, error: err instanceof Error ? err.message : String(err) });
        throw err;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    ensureLoaded() {
      // Served from cache when warm; one shared request when cold.
      if (loadedOnce && snapshot.data !== undefined) return Promise.resolve(snapshot.data);
      return load();
    },
    invalidate() {
      loadedOnce = false;
      // Revalidate immediately only if someone is observing; otherwise the next
      // reader's `ensureLoaded` will pick it up.
      if (listeners.size > 0) void load();
    },
    set(next) {
      loadedOnce = true;
      emit({ data: next, error: null });
    },
    update(recipe) {
      loadedOnce = true;
      emit({ data: recipe(snapshot.data), error: null });
    },
  };
}

/**
 * Subscribe a component to a resource store. The list is loaded on first mount
 * across the whole app and shared from cache thereafter — re-mounting a panel
 * or receiving an agent output does not refetch.
 */
export function useResource<T>(store: ResourceStore<T>): ResourceSnapshot<T> & {
  reload: () => void;
} {
  const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  React.useEffect(() => {
    void store.ensureLoaded().catch(() => {
      /* error already captured in the snapshot */
    });
  }, [store]);

  const reload = React.useCallback(() => store.invalidate(), [store]);

  return { ...snapshot, reload };
}
