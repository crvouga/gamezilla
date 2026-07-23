import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';
import { clearWatchQueryCache } from '@pkgs/sync-engine/client/watch-query-cache';
import { useEffect, useRef, useState } from 'react';

import { attachSqlCli } from '../../dev/attach-sql-cli';

export type SyncEngineBootState =
  | { phase: 'loading' }
  | { phase: 'ready'; engine: SyncEngine }
  | { phase: 'error'; error: Error };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Opens the identity-scoped sync engine for local reads as soon as the DB is
 * ready. PowerSync `connect()` runs in the background so account switches are
 * not blocked on network sync. Ignores Strict Mode cleanups that cancel an
 * in-flight boot of the same identity.
 *
 * When `enginePromise` changes (account switch), loading is applied during
 * render — not only in useEffect — so children never read the new accountId
 * against the previous identity's SQLite for a frame.
 */
export function useSyncEngineBootState(
  enginePromise: Promise<SyncEngine>
): SyncEngineBootState {
  const [boot, setBoot] = useState<SyncEngineBootState>({ phase: 'loading' });
  const [resolvedPromise, setResolvedPromise] = useState(enginePromise);
  const generationRef = useRef(0);

  // Adjust state during render when the identity promise changes (React
  // "store reset on prop change"). Waiting for useEffect left one frame
  // where accountId was new but the old SyncEngine was still mounted —
  // profile sync then wrote the previous account's username into the roster.
  if (enginePromise !== resolvedPromise) {
    setResolvedPromise(enginePromise);
    setBoot({ phase: 'loading' });
  }

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let cancelled = false;
    setBoot({ phase: 'loading' });
    clearWatchQueryCache();

    void enginePromise.then(
      (engine) => {
        if (cancelled || generation !== generationRef.current) return;
        attachSqlCli(engine.db);
        setBoot({ phase: 'ready', engine });
        void engine.connect().then(
          () => undefined,
          (error: unknown) => {
            if (cancelled || generation !== generationRef.current) return;
            console.warn(
              'sync-engine connect failed',
              toError(error).message
            );
          }
        );
      },
      (error: unknown) => {
        if (cancelled || generation !== generationRef.current) return;
        setBoot({ phase: 'error', error: toError(error) });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [enginePromise]);

  return boot;
}
