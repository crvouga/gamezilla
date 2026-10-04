import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_EXPIRES_AT_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared/auth-storage-keys';
import {
  shouldClearAccountOnExternalUserChange,
  shouldClearCapabilityOnBaSignedOut,
} from '@libs/auth-shared/resolve-client-identity';
import { SessionCapabilityStore } from '@libs/auth-shared/session-capability';
import {
  authSessionError,
  isAuthSessionSignedIn,
} from '@libs/auth-shared/session-snapshot';
import type { AuthClientPort } from '@pkgs/auth-root-shared/auth-client-port';
import type { AuthSessionState } from '@pkgs/auth-root-shared/auth-session-state';
import { useTimers } from '@pkgs/clock-client/solid';
import {
  useHttpClient,
  useOptionalOriginAvailability,
} from '@pkgs/http-client-client/solid';
import { useLogger } from '@pkgs/logger-client/solid';
import {
  createSecureStorageItem,
  useSecureStorageStore,
} from '@pkgs/secure-storage-root-client/solid';
import { writeSecureStorageItem } from '@pkgs/secure-storage-root-shared/secure-storage-store';
import { createSubscriptionSignal } from '@pkgs/solid-context-client/subscription-signal';
import { useCreateId } from '@pkgs/uuid-client/solid';
import {
  type Accessor,
  createEffect,
  createMemo,
  type JSX,
  onCleanup,
  type ParentProps,
} from 'solid-js';
import type { AuthBridgeRefreshDeps } from './auth-bridge-refresh';
import { AuthBridgeRefresh } from './auth-bridge-refresh';
import { useAuthClientPort } from './auth-client-provider';
import { useConfigService } from './config-service-context';
import { SessionBearerTokenResolver } from './resolve-session-bearer-token';
import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import { useFreshAuthToken } from './use-fresh-auth-token';

function normalizeExpiresAt(raw: unknown): string | null {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
}

function useClearStaleAccountOnExternalUserChange(args: {
  authState: Accessor<AuthSessionState>;
  deps: Accessor<AuthBridgeRefreshDeps>;
}): void {
  const previousExternalUserIdRef = { current: null as string | null };

  createEffect(() => {
    const authState = args.authState();
    const isHydrated = authState.isHydrated;
    const isSignedIn = isAuthSessionSignedIn(authState);
    const externalUserId = authState.session?.externalUserId ?? null;
    if (!isHydrated) return;
    if (!isSignedIn || externalUserId === null) {
      if (!isSignedIn) previousExternalUserIdRef.current = null;
      return;
    }
    const stored = new SessionCapabilityStore(
      args.deps().store
    ).readExternalUserId();
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
    const deps = args.deps();
    deps.lastSyncedTokenRef.current = null;
    void writeSecureStorageItem(deps.store, LAST_LOCAL_ACCOUNT_ID_KEY, null);
  });
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
  if (deps.lastSyncedTokenRef.current === token) return;
  // The token becomes the session only once its account is ready.
  await new AuthBridgeRefresh(deps).runRefresh({
    token,
    expiresAt,
    externalUserId,
    force: false,
  });
}

function useStorageFirstBoot(args: {
  deps: Accessor<AuthBridgeRefreshDeps>;
  tokenHydrated: Accessor<boolean>;
  accountIdHydrated: Accessor<boolean>;
}): void {
  const bootedRef = { current: false };

  createEffect(() => {
    if (
      !args.tokenHydrated() ||
      !args.accountIdHydrated() ||
      bootedRef.current
    ) {
      return;
    }
    const deps = args.deps();
    const session = new SessionCapabilityStore(deps.store);
    const token = session.readToken();
    bootedRef.current = true;
    if (token === null) {
      void new AuthBridgeRefresh(deps).bindLocalAccountThenEnsure();
      return;
    }
    const expiresAt = session.readExpiresAt();
    const externalUserId = session.readExternalUserId();
    deps.lastSyncedTokenRef.current = null;
    void new AuthBridgeRefresh(deps).runRefresh({
      token,
      expiresAt,
      externalUserId,
      force: true,
    });
  });
}

function useReconcileAuthSession(args: {
  authState: Accessor<AuthSessionState>;
  port: AuthClientPort;
  deps: Accessor<AuthBridgeRefreshDeps>;
}): void {
  const wasBaSignedInRef = { current: false };
  const chainRef = { current: Promise.resolve() };

  createEffect(() => {
    const authState = args.authState();
    if (!authState.isHydrated) return;
    const signedIn = isAuthSessionSignedIn(authState);
    const expiresAt = normalizeExpiresAt(authState.session?.expiresAt ?? null);
    const externalUserId = authState.session?.externalUserId ?? null;
    const sessionError = authSessionError(authState);
    const deps = args.deps();
    chainRef.current = chainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (sessionError !== null) {
          deps.log.warn('auth session error', { error: sessionError.message });
        }
        if (!signedIn) {
          const storedToken = new SessionCapabilityStore(
            deps.store
          ).readToken();
          const rotateAccount =
            wasBaSignedInRef.current || storedToken !== null;
          const clear = shouldClearCapabilityOnBaSignedOut({
            storedToken,
            wasBaSignedIn: wasBaSignedInRef.current,
          });
          wasBaSignedInRef.current = false;
          if (clear) {
            await new AuthBridgeRefresh(deps).handleSignedOut({
              rotateAccount,
            });
          }
          return;
        }
        if (!wasBaSignedInRef.current) {
          deps.lastSyncedTokenRef.current = null;
          wasBaSignedInRef.current = true;
        }
        await handleBaSignedIn({
          deps,
          port: args.port,
          expiresAt,
          externalUserId,
        });
      });
  });
}

function subscribeToForeground(onForeground: () => void): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') onForeground();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}

function useRefreshOnAppForeground(args: {
  enabled: Accessor<boolean>;
  port: AuthClientPort;
  expiresAt: Accessor<string | null>;
  externalUserId: Accessor<string | null>;
  deps: Accessor<AuthBridgeRefreshDeps>;
}): void {
  createEffect(() => {
    if (!args.enabled()) return;
    const unsubscribe = subscribeToForeground(() => {
      void (async () => {
        const deps = args.deps();
        const token = await new SessionBearerTokenResolver(deps.timers).resolve(
          args.port
        );
        if (token === null) return;
        await new AuthBridgeRefresh(deps).runRefresh({
          token,
          expiresAt: args.expiresAt(),
          externalUserId: args.externalUserId(),
          force: true,
        });
      })();
    });
    onCleanup(unsubscribe);
  });
}

/**
 * How often a signed-in device re-checks its session with the server. A
 * session can end elsewhere — "sign out of all devices", the account holder
 * revoking the app at Apple — and a device that never asks would keep
 * showing itself signed in.
 */
export const SESSION_REVALIDATE_MS = 60_000;

function useRevalidateSession(args: {
  enabled: Accessor<boolean>;
  port: AuthClientPort;
}): void {
  const timers = useTimers();
  createEffect(() => {
    if (!args.enabled()) return;
    const id = timers.setInterval(() => {
      void args.port.session.refresh();
    }, SESSION_REVALIDATE_MS);
    onCleanup(() => timers.clearInterval(id));
  });
}

/**
 * Reconciles local session capability (`sessionToken` + meta) with identity
 * refresh. IdP `useSession` is a ceremony/reconcile trigger only —
 * chrome reads secure storage.
 */
export function AuthBridge(props: ParentProps): JSX.Element {
  const apiUrl = useConfigService().getApiUrl();
  const port = useAuthClientPort();
  const authState = createSubscriptionSignal(port.session);
  const store = useSecureStorageStore();
  const deviceId = useDeviceId();
  const { fetch: fetchFn } = useHttpClient();
  const originAvailability = useOptionalOriginAvailability();
  const authToken = useFreshAuthToken();
  const tokenItem = createSecureStorageItem(SESSION_TOKEN_KEY);
  const accountItem = createSecureStorageItem(LAST_LOCAL_ACCOUNT_ID_KEY);
  const expiresItem = createSecureStorageItem(SESSION_EXPIRES_AT_KEY);
  const currentAccountId = useCurrentAccountId();
  const log = useLogger('auth-bridge');
  const timers = useTimers();
  const createId = useCreateId();
  const lastSyncedTokenRef = { current: null as string | null };
  const inFlightRef = { current: false };
  const pendingTokenRef = { current: null as string | null };
  const signingInTokenRef = { current: null as string | null };

  const expiresAt = createMemo(
    () =>
      normalizeExpiresAt(authState().session?.expiresAt ?? null) ??
      (typeof expiresItem.value() === 'string' ? expiresItem.value() : null)
  );
  const externalUserId = createMemo(
    () =>
      authState().session?.externalUserId ??
      new SessionCapabilityStore(store).readExternalUserId()
  );
  const deps = createMemo<AuthBridgeRefreshDeps>(() => ({
    apiUrl,
    deviceId: deviceId(),
    fetchFn,
    store,
    log,
    timers,
    createId,
    lastSyncedTokenRef,
    inFlightRef,
    pendingTokenRef,
    signingInTokenRef,
    ...(originAvailability?.kind === 'health'
      ? {
          waitUntilAvailable: (signal?: AbortSignal | null) =>
            originAvailability.waitUntilAvailable(signal),
        }
      : {}),
  }));

  useStorageFirstBoot({
    deps,
    tokenHydrated: tokenItem.isHydrated,
    accountIdHydrated: accountItem.isHydrated,
  });
  useClearStaleAccountOnExternalUserChange({ authState, deps });
  useReconcileAuthSession({ authState, port, deps });
  const refreshEnabled = createMemo(
    () => authToken() !== null && currentAccountId() !== null
  );
  useRefreshOnAppForeground({
    enabled: refreshEnabled,
    port,
    expiresAt,
    externalUserId,
    deps,
  });
  useRevalidateSession({ enabled: refreshEnabled, port });

  return <>{props.children}</>;
}
