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
  }, [isHydrated, isSignedIn, sessionError, expiresAt, port, deps]);
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
    // eslint-disable-next-line lingui/no-unlocalized-strings -- React Native AppState event name.
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled, port, tokenRef, expiresAtRef, deps]);
}

/**
 * Reconciles the auth port session with local secure-storage pointers
 * (`sessionToken`, `lastLocalAccountId`) and triggers `POST /auth/refresh` to
 * populate local sync with the canonical account / accountSession /
 * accountProvider / device rows.
 *
 * Pure side-effect component — renders nothing visible. Mount somewhere inside
 * the sync-engine provider tree but outside any per-route layout.
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
  await runRefresh({ deps, token, expiresAt, force: false });
}

async function runRefresh(args: {
  deps: RefreshDeps;
  token: string;
  expiresAt: string | null;
  force: boolean;
}): Promise<void> {
  const { deps, token, expiresAt, force } = args;
  if (deps.inFlightRef.current) return;
  if (!force && deps.lastSyncedTokenRef.current === token) return;
  deps.inFlightRef.current = true;
  try {
    await writeSecureStorageItem(deps.storage, SESSION_TOKEN_KEY, token);
    const resolvedExpiresAt =
      expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
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
    await flushSyncIdentityOnSignIn();
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
