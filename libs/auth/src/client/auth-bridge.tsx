import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';
import { useLogger } from '@pkgs/logger/react';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuthClientPort } from './auth-client-provider';
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from './auth-storage-keys';
import { flushSyncIdentityOnSignIn } from './sync-identity-flush';
import { collectDeviceSnapshot } from './collect-device-snapshot';
import { useConfigService } from './config-service-context';
import { refreshAuth } from './refresh-auth-fetch';
import { authSessionError, isAuthSessionSignedIn } from './session-snapshot';
import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import { getCachedAuthToken, useFreshAuthToken } from './use-fresh-auth-token';

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
  pendingTokenRef: TokenRef;
};

function normalizeExpiresAt(raw: unknown): string | null {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
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

  useEffect(() => {
    if (!isHydrated) return;
    void (async () => {
      if (sessionError !== null) {
        deps.log.warn('auth session error', { error: sessionError.message });
      }
      if (!isSignedIn) {
        if (getCachedAuthToken() !== null) return;
        await handleSignedOut(deps);
        return;
      }
      await handleSignedIn({ deps, port, expiresAt });
    })();
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
  const storage = useSecureStorage();
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
      storage,
      log,
      lastSyncedTokenRef,
      inFlightRef,
      pendingTokenRef,
    }),
    [apiUrl, deviceId, storage, log]
  );

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
  await writeSecureStorageItem(deps.storage, SESSION_TOKEN_KEY, token);
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
  await writeSecureStorageItem(
    deps.storage,
    LAST_LOCAL_ACCOUNT_ID_KEY,
    accountId
  );
  await flushSyncIdentityOnSignIn();
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
    await writeSecureStorageItem(deps.storage, SESSION_TOKEN_KEY, token);
    const { accountId } = await refreshAuth({
      apiUrl: deps.apiUrl,
      bearerToken: token,
      deviceId: deps.deviceId,
      deviceSnapshot: collectDeviceSnapshot(),
    });
    const currentToken = getCachedAuthToken();
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
