import { getCachedCurrentAccountId } from '@libs/auth/client/use-current-account-id';
import { useFreshAuthToken } from '@libs/auth/client/use-fresh-auth-token';
import type { SyncEngine } from '@pkgs/sync-engine/client/sync-engine-port';
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

function connectEngine(engine: SyncEngine): void {
  void engine.connect().then(
    () => undefined,
    (error: unknown) => {
      console.warn('sync-engine connect failed', toError(error).message);
    }
  );
}

/**
 * Opens the identity-scoped sync engine for local reads as soon as the DB is
 * ready. PowerSync `connect()` runs in the background so sign-in / sign-out
 * remounts are not blocked on network sync.
 *
 * When `enginePromise` changes, loading is applied during render unless a warm
 * pooled engine is already available for the new identity.
 */
export function useSyncEngineBootState(
  enginePromise: Promise<SyncEngine>,
  warmEngine: SyncEngine | null
): SyncEngineBootState {
  const authToken = useFreshAuthToken();
  const [boot, setBoot] = useState<SyncEngineBootState>(() =>
    initialBootState(warmEngine)
  );
  const [resolvedPromise, setResolvedPromise] = useState(enginePromise);
  const generationRef = useRef(0);
  const connectedKeyRef = useRef<string | null>(null);
  const readyEngine =
    boot.phase === 'ready' ? boot.engine : (warmEngine ?? null);

  if (enginePromise !== resolvedPromise) {
    setResolvedPromise(enginePromise);
    setBoot(initialBootState(warmEngine));
  }

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let cancelled = false;
    connectedKeyRef.current = null;
    if (warmEngine === null) {
      setBoot({ phase: 'loading' });
    }

    void enginePromise.then(
      (engine) => {
        if (cancelled || generation !== generationRef.current) return;
        attachSqlCli(engine.db);
        setBoot({ phase: 'ready', engine });
      },
      (error: unknown) => {
        if (cancelled || generation !== generationRef.current) return;
        setBoot({ phase: 'error', error: toError(error) });
      }
    );

    return () => {
      cancelled = true;
    };
  }, [enginePromise, warmEngine]);

  useEffect(() => {
    if (readyEngine === null) return;
    const accountId = getCachedCurrentAccountId();
    if (accountId !== null && authToken === null) {
      return;
    }
    // Reconnect only on identity / signed-in presence changes — NOT on every
    // bearer token refresh. Including the raw token forced PowerSync to
    // disconnect+reconnect on each AuthBridge write, which aborted downloads
    // and made cross-device space sync look broken.
    const authPresence = authToken !== null ? 'authed' : 'anon';
    const connectKey = `${accountId ?? 'anon'}:${authPresence}`;
    if (connectedKeyRef.current === connectKey) return;
    connectedKeyRef.current = connectKey;
    connectEngine(readyEngine);
  }, [readyEngine, authToken]);

  return boot;
}
