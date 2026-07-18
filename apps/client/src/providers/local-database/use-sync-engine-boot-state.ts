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
 * Connects the identity-scoped sync engine. OPFS open serialization lives in
 * {@link openPowerSyncDatabase}; this hook only connects and ignores Strict
 * Mode cleanups that cancel an in-flight boot of the same identity.
 */
export function useSyncEngineBootState(
  enginePromise: Promise<SyncEngine>
): SyncEngineBootState {
  const [boot, setBoot] = useState<SyncEngineBootState>({ phase: 'loading' });
  const generationRef = useRef(0);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let cancelled = false;
    setBoot({ phase: 'loading' });
    clearWatchQueryCache();

    void enginePromise.then(
      (engine) => {
        if (cancelled || generation !== generationRef.current) return;
        void engine.connect().then(
          () => {
            if (cancelled || generation !== generationRef.current) return;
            attachSqlCli(engine.db);
            setBoot({ phase: 'ready', engine });
          },
          (error: unknown) => {
            if (cancelled || generation !== generationRef.current) return;
            setBoot({ phase: 'error', error: toError(error) });
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
