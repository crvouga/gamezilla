import { useEffect, useRef } from 'react';

// #region agent log
function _debugLog(message: string, data: Record<string, unknown>): void {
  if (typeof fetch === 'undefined') return;
  fetch('http://127.0.0.1:7510/ingest/c52c9028-9c01-42a4-9186-01f9b18984a5', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '165003',
    },
    body: JSON.stringify({
      sessionId: '165003',
      location: 'use-cached-promise.ts',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
let _debugInstanceCounter = 0;
// #endregion

/**
 * Stable, render-phase cache for a single in-flight promise — designed for
 * feeding `React.use(...)` from a Client Component without tripping the
 * "A component was suspended by an uncached promise" infinite-loop guard.
 *
 * Why not `useMemo`? React 19 explicitly treats `useMemo` as best-effort and
 * may drop the memoized value across renders (including Suspense retries).
 * If `use()` sees a fresh promise on every retry it never settles, React
 * detects the loop and throws. Refs are guaranteed to persist for the
 * lifetime of a mounted component instance, so they're a real cache.
 *
 * The factory receives an `AbortSignal` that is aborted when:
 *   - `key` changes (the previous promise is cancelled before a new one is
 *     created), or
 *   - the host component unmounts.
 *
 * @param key Deterministic cache key derived from render-phase inputs.
 *            Whenever it changes, the prior promise is aborted and a new
 *            one is created.
 * @param factory Pure factory that constructs the promise. Called at most
 *                once per distinct `key` per mounted instance.
 */
export function useCachedPromise<T>(
  key: string,
  factory: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  type Cache = {
    key: string;
    controller: AbortController;
    promise: Promise<T>;
  };
  const cacheRef = useRef<Cache | null>(null);
  // #region agent log
  const instanceIdRef = useRef<number | null>(null);
  if (instanceIdRef.current === null) {
    _debugInstanceCounter += 1;
    instanceIdRef.current = _debugInstanceCounter;
  }
  // #endregion

  if (cacheRef.current === null || cacheRef.current.key !== key) {
    // #region agent log
    _debugLog('useCachedPromise creating new promise', {
      hypothesisId: 'A,B,D',
      instanceId: instanceIdRef.current,
      key,
      prevKey: cacheRef.current?.key ?? null,
      reason: cacheRef.current === null ? 'ref-null' : 'key-change',
    });
    // #endregion
    cacheRef.current?.controller.abort();
    const controller = new AbortController();
    cacheRef.current = {
      key,
      controller,
      promise: factory(controller.signal),
    };
  }

  useEffect(() => {
    // #region agent log
    _debugLog('useCachedPromise effect setup', {
      hypothesisId: 'B',
      instanceId: instanceIdRef.current,
      key,
    });
    // #endregion
    return () => {
      // #region agent log
      _debugLog('useCachedPromise effect cleanup (nulling ref)', {
        hypothesisId: 'B',
        instanceId: instanceIdRef.current,
        key,
      });
      // #endregion
      cacheRef.current?.controller.abort();
      cacheRef.current = null;
    };
  }, []);

  return cacheRef.current.promise;
}
