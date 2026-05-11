/* eslint-disable lingui/no-unlocalized-strings -- file contains agent debug instrumentation */
import { useLogger } from '@gamezilla/lib/logger/react';
import { useSecureStorage } from '@gamezilla/lib/secure-storage/interface';
import { writeSecureStorageItem } from '@gamezilla/lib/secure-storage/use-secure-storage-item';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from './auth-storage-keys';
import {
  authBaseUrl,
  useAuthClient,
  type SessionSnapshot,
} from './better-auth-client';
import { collectDeviceSnapshot } from './collect-device-snapshot';
import { useConfigService } from './config-service-context';
import { refreshAuth } from './refresh-auth-fetch';
import { useDeviceId } from './use-device-id';
import { useSessionToken } from './use-session-token';
import { useCurrentAccountId } from './use-current-account-id';

type Storage = ReturnType<typeof useSecureStorage>;
type Logger = ReturnType<typeof useLogger>;
type TokenRef = { current: string | null };
type FlagRef = { current: boolean };
type ExpiresAtRef = { current: string | null };

type RefreshDeps = {
  apiUrl: string;
  deviceId: string;
  storage: Storage;
  log: Logger;
  lastSyncedTokenRef: TokenRef;
  inFlightRef: FlagRef;
};

/**
 * Extracts the bearer token + expiresAt from the live Better Auth session
 * snapshot returned by `authClient.useSession()`. We deliberately avoid
 * `authClient.getSession()` (which fires a network request to `/get-session`)
 * because the same data is already in the snapshot.
 */
function extractSessionFromSnapshot(snapshot: SessionSnapshot): {
  token: string | null;
  expiresAt: string | null;
} {
  if (snapshot.error !== null && snapshot.error !== undefined) {
    return { token: null, expiresAt: null };
  }
  if (snapshot.data === null || snapshot.data === undefined) {
    return { token: null, expiresAt: null };
  }
  const record = snapshot.data as {
    session?: { token?: string; expiresAt?: unknown };
  };
  const tok = record.session?.token;
  const token = typeof tok === 'string' && tok.length > 0 ? tok : null;
  const exp = record.session?.expiresAt;
  let expiresAt: string | null = null;
  if (exp instanceof Date) expiresAt = exp.toISOString();
  else if (typeof exp === 'string' && exp.length > 0) expiresAt = exp;
  return { token, expiresAt };
}

// #region agent log
function __dbg(message: string, data: Record<string, unknown>): void {
  fetch(
    'http://127.0.0.1:7510/ingest/c52c9028-9c01-42a4-9186-01f9b18984a5',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '0ed6e8',
      },
      body: JSON.stringify({
        sessionId: '0ed6e8',
        location: 'auth-bridge.tsx',
        message,
        data,
        timestamp: Date.now(),
      }),
    }
  ).catch(() => {});
}
// #endregion

function isSnapshotSignedIn(snapshot: SessionSnapshot): boolean {
  return (
    (snapshot.error === null || snapshot.error === undefined) &&
    snapshot.data !== null &&
    snapshot.data !== undefined
  );
}

// #region agent log
let __reconcileEffectCount = 0;
const __depsIdMap = new WeakMap<object, number>();
let __depsIdSeq = 0;
function __depsIdOf(d: object): number {
  let id = __depsIdMap.get(d);
  if (id === undefined) {
    __depsIdSeq += 1;
    id = __depsIdSeq;
    __depsIdMap.set(d, id);
  }
  return id;
}
// #endregion

function useReconcileBetterAuthSession(args: {
  snapshot: SessionSnapshot;
  token: string | null;
  expiresAt: string | null;
  deps: RefreshDeps;
}): void {
  const { snapshot, token, expiresAt, deps } = args;
  const isPending = snapshot.isPending;
  const isSignedIn = isSnapshotSignedIn(snapshot);
  useEffect(() => {
    // #region agent log
    __reconcileEffectCount += 1;
    __dbg('useReconcileBetterAuthSession:effect', {
      hypothesisId: 'H2,H3,post-fix',
      runId: 'post-fix',
      effectCount: __reconcileEffectCount,
      isPending,
      isSignedIn,
      tokenPresent: token !== null,
      expiresAtPresent: expiresAt !== null,
      depsId: __depsIdOf(deps),
    });
    // #endregion
    if (isPending) return;
    void (async () => {
      if (!isSignedIn || token === null) {
        await handleSignedOut(deps);
        return;
      }
      await handleSignedIn({ deps, token, expiresAt });
    })();
  }, [isPending, isSignedIn, token, expiresAt, deps]);
}

function useRefreshOnAppForeground(args: {
  enabled: boolean;
  tokenRef: TokenRef;
  expiresAtRef: ExpiresAtRef;
  deps: RefreshDeps;
}): void {
  const { enabled, tokenRef, expiresAtRef, deps } = args;
  useEffect(() => {
    if (!enabled) return;
    const onChange = (state: AppStateStatus): void => {
      if (state !== 'active') return;
      const token = tokenRef.current;
      if (token === null) return;
      void runRefresh({
        deps,
        token,
        expiresAt: expiresAtRef.current,
        force: true,
      });
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled, tokenRef, expiresAtRef, deps]);
}

/**
 * Reconciles Better Auth's session snapshot with our local secure-storage
 * pointers (`sessionToken`, `lastLocalAccountId`) and triggers
 * `POST /auth/refresh` to populate PatchDB with the canonical account /
 * accountSession / accountProvider / device rows.
 *
 * Pure side-effect component — renders nothing visible. Mount somewhere
 * inside the patch-db provider tree but outside any per-route layout.
 */
export function AuthBridge(): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const baseURL = useMemo(() => authBaseUrl(apiUrl), [apiUrl]);
  const authClient = useAuthClient(baseURL);
  const snapshot: SessionSnapshot = authClient.useSession();
  const storage = useSecureStorage();
  const deviceId = useDeviceId();
  const sessionToken = useSessionToken();
  const currentAccountId = useCurrentAccountId();
  const log = useLogger('auth-bridge');
  const lastSyncedTokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef<string | null>(null);

  const { token, expiresAt } = extractSessionFromSnapshot(snapshot);
  tokenRef.current = token;
  expiresAtRef.current = expiresAt;

  const deps = useMemo<RefreshDeps>(
    () => ({
      apiUrl,
      deviceId,
      storage,
      log,
      lastSyncedTokenRef,
      inFlightRef,
    }),
    [apiUrl, deviceId, storage, log]
  );

  // #region agent log
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  __dbg('AuthBridge:render', {
    hypothesisId: 'H2,H3,H5,post-fix',
    runId: 'post-fix',
    renderCount: renderCountRef.current,
    isPending: snapshot.isPending,
    isRefetching: (snapshot as { isRefetching?: boolean }).isRefetching,
    snapshotDataPresent: snapshot.data !== null && snapshot.data !== undefined,
    snapshotErrorPresent: snapshot.error !== null && snapshot.error !== undefined,
    tokenPresent: token !== null,
    expiresAtPresent: expiresAt !== null,
    sessionTokenPresent: sessionToken !== null,
    currentAccountIdPresent: currentAccountId !== null,
    depsId: __depsIdOf(deps),
  });
  // #endregion

  useReconcileBetterAuthSession({ snapshot, token, expiresAt, deps });
  useRefreshOnAppForeground({
    enabled: sessionToken !== null && currentAccountId !== null,
    tokenRef,
    expiresAtRef,
    deps,
  });

  return null;
}

async function handleSignedIn(args: {
  deps: RefreshDeps;
  token: string;
  expiresAt: string | null;
}): Promise<void> {
  const { deps, token, expiresAt } = args;
  // #region agent log
  __dbg('handleSignedIn:enter', {
    hypothesisId: 'H1,H2,post-fix',
    runId: 'post-fix',
    lastSyncedTokenPresent: deps.lastSyncedTokenRef.current !== null,
    tokenPresent: true,
    expiresAtPresent: expiresAt !== null,
  });
  // #endregion
  await writeSecureStorageItem(deps.storage, SESSION_TOKEN_KEY, token);
  if (deps.lastSyncedTokenRef.current === token) return;
  await runRefresh({ deps, token, expiresAt, force: false });
}

async function runRefresh(args: {
  deps: RefreshDeps;
  token: string;
  expiresAt: string | null;
  force: boolean;
}): Promise<void> {
  const { deps, token, expiresAt, force } = args;
  // #region agent log
  __dbg('runRefresh:enter', {
    hypothesisId: 'H1,H4,post-fix',
    runId: 'post-fix',
    force,
    inFlight: deps.inFlightRef.current,
    lastSyncedTokenMatches: deps.lastSyncedTokenRef.current === token,
  });
  // #endregion
  if (deps.inFlightRef.current) return;
  if (!force && deps.lastSyncedTokenRef.current === token) return;
  deps.inFlightRef.current = true;
  try {
    await writeSecureStorageItem(deps.storage, SESSION_TOKEN_KEY, token);
    const resolvedExpiresAt =
      expiresAt ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { accountId } = await refreshAuth({
      apiUrl: deps.apiUrl,
      bearerToken: token,
      deviceId: deps.deviceId,
      deviceSnapshot: collectDeviceSnapshot(),
      accountSessionExpiresAt: resolvedExpiresAt,
    });
    await writeSecureStorageItem(
      deps.storage,
      LAST_LOCAL_ACCOUNT_ID_KEY,
      accountId
    );
    deps.lastSyncedTokenRef.current = token;
  } catch (e) {
    deps.log.error('auth/refresh failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    deps.inFlightRef.current = false;
  }
}

async function handleSignedOut(deps: RefreshDeps): Promise<void> {
  deps.lastSyncedTokenRef.current = null;
  try {
    await writeSecureStorageItem(deps.storage, SESSION_TOKEN_KEY, null);
  } catch (e) {
    deps.log.warn('clear session token failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    await writeSecureStorageItem(deps.storage, LAST_LOCAL_ACCOUNT_ID_KEY, null);
  } catch (e) {
    deps.log.warn('clear last local account id failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
