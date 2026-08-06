import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';
import { useLogger } from '@pkgs/logger/react';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import {
  useSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuthClientPort } from './auth-client-provider';
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from './auth-storage-keys';
import { collectDeviceSnapshot } from './collect-device-snapshot';
import { useConfigService } from './config-service-context';
import { ensureAnonAuth } from './ensure-anon-auth-fetch';
import { refreshAuth } from './refresh-auth-fetch';
import {
  shouldBindAnonUserAfterEnsure,
  shouldClearAccountOnExternalUserChange,
} from './resolve-client-identity';
import { authSessionError, isAuthSessionSignedIn } from './session-snapshot';
import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import { useFreshAuthToken } from './use-fresh-auth-token';

type Logger = ReturnType<typeof useLogger>;
type TokenRef = { current: string | null };
type FlagRef = { current: boolean };
type ExpiresAtRef = { current: string | null };

type RefreshDeps = {
  apiUrl: string;
  deviceId: string;
  store: SecureStorageStore;
  log: Logger;
  lastSyncedTokenRef: TokenRef;
  inFlightRef: FlagRef;
  pendingTokenRef: TokenRef;
};

function normalizeExpiresAt(raw: unknown): string | null {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
}

function readSessionToken(store: SecureStorageStore): string | null {
  const raw = store.getValue(SESSION_TOKEN_KEY);
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
}

function useClearStaleAccountOnExternalUserChange(args: {
  authState: AuthSessionState;
  deps: RefreshDeps;
}): void {
  const { authState, deps } = args;
  const isHydrated = authState.isHydrated;
  const isSignedIn = isAuthSessionSignedIn(authState);
  const externalUserId = authState.session?.externalUserId ?? null;
  const previousExternalUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isSignedIn || externalUserId === null) {
      if (!isSignedIn) previousExternalUserIdRef.current = null;
      return;
    }
    const previous = previousExternalUserIdRef.current;
    previousExternalUserIdRef.current = externalUserId;
    if (
      !shouldClearAccountOnExternalUserChange(
        previous,
        externalUserId,
        isSignedIn
      )
    ) {
      return;
    }
    deps.lastSyncedTokenRef.current = null;
    void writeSecureStorageItem(deps.store, LAST_LOCAL_ACCOUNT_ID_KEY, null);
  }, [deps, externalUserId, isHydrated, isSignedIn]);
}

function useReconcileAuthSession(args: {
  authState: AuthSessionState;
  port: AuthClientPort;
  deps: RefreshDeps;
}): void {
  const { authState, port, deps } = args;
  const isHydrated = authState.isHydrated;
  const isSignedIn = isAuthSessionSignedIn(authState);
  const sessionError = authSessionError(authState);
  const expiresAt = normalizeExpiresAt(authState.session?.expiresAt ?? null);
  const externalUserId = authState.session?.externalUserId ?? null;
  const wasSignedInRef = useRef(false);
  const chainRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!isHydrated) return;
    const signedIn = isSignedIn;
    const exp = expiresAt;
    const err = sessionError;
    chainRef.current = chainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (err !== null) {
          deps.log.warn('auth session error', { error: err.message });
        }
        if (!signedIn) {
          wasSignedInRef.current = false;
          await handleSignedOut(deps);
          return;
        }
        // Cold start / sign-in transition: never skip refresh — recovers when a
        // stale anon ensure overwrote lastLocalAccountId after a prior refresh.
        if (!wasSignedInRef.current) {
          deps.lastSyncedTokenRef.current = null;
          wasSignedInRef.current = true;
        }
        await handleSignedIn({ deps, port, expiresAt: exp });
      });
  }, [
    isHydrated,
    isSignedIn,
    sessionError,
    expiresAt,
    externalUserId,
    port,
    deps,
  ]);
}

function useRefreshOnAppForeground(args: {
  enabled: boolean;
  port: AuthClientPort;
  tokenRef: TokenRef;
  expiresAtRef: ExpiresAtRef;
  deps: RefreshDeps;
}): void {
  const { enabled, port, tokenRef, expiresAtRef, deps } = args;
  useEffect(() => {
    if (!enabled) return;
    const onChange = (state: AppStateStatus): void => {
      if (state !== 'active') return;
      void (async () => {
        const token = await port.getFreshToken();
        if (token === null) return;
        tokenRef.current = token;
        await runRefresh({
          deps,
          token,
          expiresAt: expiresAtRef.current,
          force: true,
        });
      })();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled, port, tokenRef, expiresAtRef, deps]);
}

/**
 * Reconciles the auth port session with local secure-storage pointers
 * (`sessionToken`, `lastLocalAccountId`) and triggers `POST /auth/refresh`.
 * Sign-in remounts per-account SQLite via `lastLocalAccountId` changes.
 */
export function AuthBridge(props: PropsWithChildren): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  const store = useSecureStorageStore();
  const deviceId = useDeviceId();
  const authToken = useFreshAuthToken();
  const currentAccountId = useCurrentAccountId();
  const log = useLogger('auth-bridge');
  const lastSyncedTokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const pendingTokenRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef<string | null>(null);

  tokenRef.current = authToken;
  expiresAtRef.current = normalizeExpiresAt(
    authState.session?.expiresAt ?? null
  );

  const deps = useMemo<RefreshDeps>(
    () => ({
      apiUrl,
      deviceId,
      store,
      log,
      lastSyncedTokenRef,
      inFlightRef,
      pendingTokenRef,
    }),
    [apiUrl, deviceId, store, log]
  );

  useClearStaleAccountOnExternalUserChange({ authState, deps });
  useReconcileAuthSession({ authState, port, deps });
  useRefreshOnAppForeground({
    enabled: authToken !== null && currentAccountId !== null,
    port,
    tokenRef,
    expiresAtRef,
    deps,
  });

  return props.children;
}

async function handleSignedIn(args: {
  deps: RefreshDeps;
  port: AuthClientPort;
  expiresAt: string | null;
}): Promise<void> {
  const { deps, port, expiresAt } = args;
  const token = await port.getFreshToken();
  if (token === null) return;
  await writeSecureStorageItem(deps.store, SESSION_TOKEN_KEY, token);
  if (deps.lastSyncedTokenRef.current === token) return;
  await runRefresh({
    deps,
    token,
    expiresAt,
    force: false,
  });
}

async function applyRefreshSuccess(args: {
  readonly deps: RefreshDeps;
  readonly token: string;
  readonly accountId: string;
}): Promise<void> {
  const { deps, token, accountId } = args;
  // Sign-out may clear the token while /auth/refresh is in flight — never
  // re-bind lastLocalAccountId after the session is gone.
  if (readSessionToken(deps.store) !== token) return;
  await writeSecureStorageItem(
    deps.store,
    LAST_LOCAL_ACCOUNT_ID_KEY,
    accountId
  );
  if (readSessionToken(deps.store) !== token) {
    await writeSecureStorageItem(
      deps.store,
      LAST_LOCAL_ACCOUNT_ID_KEY,
      null
    );
    return;
  }
  deps.lastSyncedTokenRef.current = token;
}

function discardStaleRefresh(args: {
  readonly deps: RefreshDeps;
  readonly token: string;
  readonly currentToken: string | null;
  readonly accountId: string;
}): void {
  const { deps, currentToken } = args;
  deps.log.info('auth/refresh discarded; session token changed during request');
  if (currentToken !== null) {
    deps.pendingTokenRef.current = currentToken;
  }
}

async function retryPendingRefresh(
  deps: RefreshDeps,
  expiresAt: string | null
): Promise<void> {
  const pending = deps.pendingTokenRef.current;
  deps.pendingTokenRef.current = null;
  if (pending === null || pending === deps.lastSyncedTokenRef.current) {
    return;
  }
  await runRefresh({
    deps,
    token: pending,
    expiresAt,
    force: true,
  });
}

async function runRefresh(args: {
  deps: RefreshDeps;
  token: string;
  expiresAt: string | null;
  force: boolean;
}): Promise<void> {
  const { deps, token, force } = args;
  if (!force && deps.lastSyncedTokenRef.current === token) return;
  if (deps.inFlightRef.current) {
    deps.pendingTokenRef.current = token;
    return;
  }
  deps.inFlightRef.current = true;
  deps.pendingTokenRef.current = null;
  try {
    await writeSecureStorageItem(deps.store, SESSION_TOKEN_KEY, token);
    const { accountId } = await refreshAuth({
      apiUrl: deps.apiUrl,
      bearerToken: token,
      deviceId: deps.deviceId,
      deviceSnapshot: collectDeviceSnapshot(),
    });
    const currentToken = readSessionToken(deps.store);
    if (currentToken !== token) {
      discardStaleRefresh({ deps, token, currentToken, accountId });
      return;
    }
    await applyRefreshSuccess({
      deps,
      token,
      accountId,
    });
  } catch (e) {
    deps.log.error('auth/refresh failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    deps.inFlightRef.current = false;
    await retryPendingRefresh(deps, args.expiresAt);
  }
}

async function handleSignedOut(deps: RefreshDeps): Promise<void> {
  deps.lastSyncedTokenRef.current = null;
  deps.pendingTokenRef.current = null;
  try {
    await writeSecureStorageItem(deps.store, SESSION_TOKEN_KEY, null);
  } catch (e) {
    deps.log.warn('clear session token failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  // Bind (or mint) an anon users row. Server mints a new anon when the device
  // was bound to a non-anon account (post sign-out / upgrade).
  try {
    const hadUser =
      typeof deps.store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY) === 'string';
    const { userId } = await ensureAnonAuth({
      apiUrl: deps.apiUrl,
      deviceId: deps.deviceId,
      // First cold start / already-anon: reuse. After sign-out from a
      // signed-in session the device is still bound to a non-anon user on
      // the server, so forceNew is unnecessary — ensureAnonUserForDevice
      // mints when the bound user is non-anon.
      forceNew: false,
    });
    // Sign-in may have written a session token while ensure was in flight —
    // never clobber the signed-in account id with this stale anon bind.
    if (!shouldBindAnonUserAfterEnsure(readSessionToken(deps.store))) {
      deps.log.info('anon ensure discarded; session token present');
      return;
    }
    await writeSecureStorageItem(
      deps.store,
      LAST_LOCAL_ACCOUNT_ID_KEY,
      userId
    );
    if (!hadUser) {
      deps.log.info('anon user ensured', { userId });
    }
  } catch (e) {
    deps.log.error('auth/anon/ensure failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
