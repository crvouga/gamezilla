import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import type { AuthSessionState } from '@pkgs/auth/client/auth-session-state';
import { useTimers } from '@pkgs/clock';
import { useHttpClient } from '@pkgs/http-client';
import { useLogger } from '@pkgs/logger/react';
import {
  useSecureStorageItem,
  useSecureStorageStore,
  writeSecureStorageItem,
} from '@pkgs/secure-storage/use-secure-storage-item';
import type { PropsWithChildren } from 'react';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthClientPort } from '../../public/auth-client-provider';
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_EXPIRES_AT_KEY,
  SESSION_TOKEN_KEY,
} from '../../public/auth-storage-keys';
import { useConfigService } from '../../public/config-service-context';
import {
  shouldClearAccountOnExternalUserChange,
  shouldClearCapabilityOnBaSignedOut,
} from '../../public/resolve-client-identity';
import { SessionCapabilityStore } from '../../public/session-capability';
import {
  authSessionError,
  isAuthSessionSignedIn,
} from '../../public/session-snapshot';
import { useCurrentAccountId } from '../../public/use-current-account-id';
import { useDeviceId } from '../../public/use-device-id';
import { useFreshAuthToken } from '../../public/use-fresh-auth-token';
import {
  AuthBridgeRefresh,
  type AuthBridgeRefreshDeps,
} from './auth-bridge-refresh';
import { SessionBearerTokenResolver } from './resolve-session-bearer-token';

type TokenRef = { current: string | null };
type ExpiresAtRef = { current: string | null };
type ExternalUserIdRef = { current: string | null };

function normalizeExpiresAt(raw: unknown): string | null {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
}

function useClearStaleAccountOnExternalUserChange(args: {
  authState: AuthSessionState;
  deps: AuthBridgeRefreshDeps;
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
    const stored = new SessionCapabilityStore(deps.store).readExternalUserId();
    const previous = previousExternalUserIdRef.current ?? stored;
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

async function handleBaSignedIn(args: {
  deps: AuthBridgeRefreshDeps;
  port: AuthClientPort;
  expiresAt: string | null;
  externalUserId: string | null;
}): Promise<void> {
  const { deps, port, expiresAt, externalUserId } = args;
  const token = await new SessionBearerTokenResolver(deps.timers).resolve(port);
  if (token === null) {
    deps.log.warn('signed in but bearer token unavailable');
    return;
  }
  await new SessionCapabilityStore(deps.store).write({
    token,
    expiresAt,
    externalUserId,
  });
  if (deps.lastSyncedTokenRef.current === token) return;
  await new AuthBridgeRefresh(deps).runRefresh({
    token,
    expiresAt,
    externalUserId,
    force: false,
  });
}

function useStorageFirstBoot(args: {
  deps: AuthBridgeRefreshDeps;
  tokenHydrated: boolean;
}): void {
  const { deps, tokenHydrated } = args;
  const bootedRef = useRef(false);

  useEffect(() => {
    if (!tokenHydrated || bootedRef.current) return;
    const session = new SessionCapabilityStore(deps.store);
    const token = session.readToken();
    if (token === null) return;
    bootedRef.current = true;
    const expiresAt = session.readExpiresAt();
    const externalUserId = session.readExternalUserId();
    deps.lastSyncedTokenRef.current = null;
    void new AuthBridgeRefresh(deps).runRefresh({
      token,
      expiresAt,
      externalUserId,
      force: true,
    });
  }, [deps, tokenHydrated]);
}

function useReconcileAuthSession(args: {
  authState: AuthSessionState;
  port: AuthClientPort;
  deps: AuthBridgeRefreshDeps;
}): void {
  const { authState, port, deps } = args;
  const isHydrated = authState.isHydrated;
  const isSignedIn = isAuthSessionSignedIn(authState);
  const sessionError = authSessionError(authState);
  const expiresAt = normalizeExpiresAt(authState.session?.expiresAt ?? null);
  const externalUserId = authState.session?.externalUserId ?? null;
  const wasBaSignedInRef = useRef(false);
  const chainRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!isHydrated) return;
    const signedIn = isSignedIn;
    const exp = expiresAt;
    const ext = externalUserId;
    const err = sessionError;
    chainRef.current = chainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (err !== null) {
          deps.log.warn('auth session error', { error: err.message });
        }
        if (!signedIn) {
          const clear = shouldClearCapabilityOnBaSignedOut({
            storedToken: new SessionCapabilityStore(deps.store).readToken(),
            wasBaSignedIn: wasBaSignedInRef.current,
          });
          wasBaSignedInRef.current = false;
          if (clear) await new AuthBridgeRefresh(deps).handleSignedOut();
          return;
        }
        if (!wasBaSignedInRef.current) {
          deps.lastSyncedTokenRef.current = null;
          wasBaSignedInRef.current = true;
        }
        await handleBaSignedIn({
          deps,
          port,
          expiresAt: exp,
          externalUserId: ext,
        });
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
  externalUserIdRef: ExternalUserIdRef;
  deps: AuthBridgeRefreshDeps;
}): void {
  const { enabled, port, tokenRef, expiresAtRef, externalUserIdRef, deps } =
    args;
  useEffect(() => {
    if (!enabled) return;
    const onChange = (state: AppStateStatus): void => {
      if (state !== 'active') return;
      void (async () => {
        const token = await new SessionBearerTokenResolver(deps.timers).resolve(
          port
        );
        if (token === null) return;
        tokenRef.current = token;
        await new AuthBridgeRefresh(deps).runRefresh({
          token,
          expiresAt: expiresAtRef.current,
          externalUserId: externalUserIdRef.current,
          force: true,
        });
      })();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled, port, tokenRef, expiresAtRef, externalUserIdRef, deps]);
}

/**
 * Reconciles local session capability (`sessionToken` + meta) with identity
 * refresh. Better Auth `useSession` is a ceremony/reconcile trigger only —
 * chrome reads secure storage.
 */
export function AuthBridge(props: PropsWithChildren): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const port = useAuthClientPort();
  const authState = port.useAuthSession();
  const store = useSecureStorageStore();
  const deviceId = useDeviceId();
  const { fetch: fetchFn } = useHttpClient();
  const authToken = useFreshAuthToken();
  const { isHydrated: tokenHydrated } = useSecureStorageItem(SESSION_TOKEN_KEY);
  const currentAccountId = useCurrentAccountId();
  const log = useLogger('auth-bridge');
  const timers = useTimers();
  const lastSyncedTokenRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  const pendingTokenRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef<string | null>(null);
  const externalUserIdRef = useRef<string | null>(null);

  tokenRef.current = authToken;
  const storedExpires = useSecureStorageItem(SESSION_EXPIRES_AT_KEY);
  expiresAtRef.current =
    normalizeExpiresAt(authState.session?.expiresAt ?? null) ??
    (typeof storedExpires.value === 'string' ? storedExpires.value : null);
  externalUserIdRef.current =
    authState.session?.externalUserId ??
    new SessionCapabilityStore(store).readExternalUserId();

  const deps = useMemo<AuthBridgeRefreshDeps>(
    () => ({
      apiUrl,
      deviceId,
      fetchFn,
      store,
      log,
      timers,
      lastSyncedTokenRef,
      inFlightRef,
      pendingTokenRef,
    }),
    [apiUrl, deviceId, fetchFn, store, log, timers]
  );

  useStorageFirstBoot({ deps, tokenHydrated });
  useClearStaleAccountOnExternalUserChange({ authState, deps });
  useReconcileAuthSession({ authState, port, deps });
  useRefreshOnAppForeground({
    enabled: authToken !== null && currentAccountId !== null,
    port,
    tokenRef,
    expiresAtRef,
    externalUserIdRef,
    deps,
  });

  return props.children;
}
