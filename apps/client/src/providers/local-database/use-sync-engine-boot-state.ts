import type { SyncEngine } from '@pkgs/sync-engine/client';
import { useEffect, useRef, useState } from 'react';

import { attachSqlCli } from '../../dev/attach-sql-cli';

export type SyncEngineBootState =
  | { phase: 'loading' }
  | { phase: 'ready'; engine: SyncEngine }
  | { phase: 'error'; error: Error };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Pool may expose an engine before session queries finish — only paint-cache those. */
function engineHasEverSynced(engine: SyncEngine): boolean {
  return engine.status.getSnapshot().hasEverSynced;
}

function initialBootState(warmEngine: SyncEngine | null): SyncEngineBootState {
  if (warmEngine !== null && engineHasEverSynced(warmEngine)) {
    return { phase: 'ready', engine: warmEngine };
  }
  return { phase: 'loading' };
}

/**
 * Opens the identity-scoped sync engine for local reads as soon as the DB is
 * ready. A cold launch waits for the boot query set; warm identities that have
 * already completed a first sync paint cached SQLite immediately while polling
 * reconnects. Remounts before first sync (e.g. playground UI↔DB tab) still wait.
 */
export function useSyncEngineBootState(
  enginePromise: Promise<SyncEngine>,
  warmEngine: SyncEngine | null
): SyncEngineBootState {
  const [boot, setBoot] = useState<SyncEngineBootState>(() =>
    initialBootState(warmEngine)
  );
  const [resolvedPromise, setResolvedPromise] = useState(enginePromise);
  const generationRef = useRef(0);
  const paintFromCache = warmEngine !== null && engineHasEverSynced(warmEngine);

  if (enginePromise !== resolvedPromise) {
    setResolvedPromise(enginePromise);
    setBoot(initialBootState(warmEngine));
  }

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let cancelled = false;
    if (!paintFromCache) {
      setBoot({ phase: 'loading' });
    }

    void enginePromise
      .then(async (engine) => {
        await engine.connect();
        if (!paintFromCache) await engine.waitForFirstSync();
        if (cancelled || generation !== generationRef.current) return;
        attachSqlCli(engine.db);
        setBoot({ phase: 'ready', engine });
      })
      .catch((error: unknown) => {
        if (cancelled || generation !== generationRef.current) return;
        setBoot({ phase: 'error', error: toError(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [enginePromise, paintFromCache]);

  return boot;
}
