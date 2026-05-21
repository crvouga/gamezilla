/**
 * Stable, app-lifetime cache for a single in-flight promise — designed for
 * feeding `React.use(...)` from a Client Component without tripping the
 * "A component was suspended by an uncached promise" infinite-loop guard.
 *
 * Why module-level instead of `useRef`/`useMemo`? A component that suspends
 * on its very first render never commits — its hook state (including
 * `useRef`) is discarded on each Suspense retry, so a ref-based cache hands
 * `use()` a brand-new promise on every retry and React detects the loop.
 * `useMemo` is best-effort in React 19 and has the same risk. A module-
 * level map is the only cache that reliably survives those retries.
 *
 * Intended use: app-singleton resources (SQL client, device service,
 * patch-db) that are constructed exactly once per process. The factory's
 * `AbortSignal` is wired but never aborted — these resources live for the
 * app's lifetime.
 *
 * @param key Stable cache key. Must uniquely identify the resource for the
 *            entire process lifetime; callers must namespace keys to avoid
 *            collisions across distinct resources.
 * @param factory Pure factory that constructs the promise. Called at most
 *                once per distinct `key` per process.
 */
const promiseCache = new Map<string, Promise<unknown>>();

export function useCachedPromise<T>(
  key: string,
  factory: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  let cached = promiseCache.get(key) as Promise<T> | undefined;
  if (cached === undefined) {
    cached = factory(new AbortController().signal);
    promiseCache.set(key, cached);
  }
  return cached;
}
