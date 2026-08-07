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

function initialBootState(warmEngine: SyncEngine | null): SyncEngineBootState {
  if (warmEngine !== null) {
    return { phase: 'ready', engine: warmEngine };
  }
  return { phase: 'loading' };
}

/**
 * Opens the identity-scoped sync engine for local reads as soon as the DB is
 * ready. A cold launch waits for the boot query set; warm identities paint
 * cached SQLite immediately while polling reconnects.
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

  if (enginePromise !== resolvedPromise) {
    setResolvedPromise(enginePromise);
    setBoot(initialBootState(warmEngine));
  }

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let cancelled = false;
    if (warmEngine === null) {
      setBoot({ phase: 'loading' });
    }

    void enginePromise
      .then(async (engine) => {
        await engine.connect();
        if (warmEngine === null) await engine.waitForFirstSync();
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
  }, [enginePromise, warmEngine]);

  return boot;
}
