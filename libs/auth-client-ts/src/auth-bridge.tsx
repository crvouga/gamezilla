import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_EXPIRES_AT_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import {
  shouldClearAccountOnExternalUserChange,
  shouldClearCapabilityOnBaSignedOut,
} from '@libs/auth-shared-ts/resolve-client-identity';
import { SessionCapabilityStore } from '@libs/auth-shared-ts/session-capability';
import {
  authSessionError,
  isAuthSessionSignedIn,
} from '@libs/auth-shared-ts/session-snapshot';
import type { AuthClientPort } from '@pkgs/auth-root-shared-ts/auth-client-port';
import type { AuthSessionState } from '@pkgs/auth-root-shared-ts/auth-session-state';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import {
  useHttpClient,
  useOptionalOriginAvailability,
} from '@pkgs/http-client-client-ts/solid';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import {
  createSecureStorageItem,
  useSecureStorageStore,
} from '@pkgs/secure-storage-root-client-ts/solid';
import { writeSecureStorageItem } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import { createSubscriptionSignal } from '@pkgs/solid-context-client-ts/subscription-signal';
import { useCreateId } from '@pkgs/uuid-client-ts/solid';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createEffect,
  createMemo,
  type ParentProps,
} from 'solid-js';
import type { AuthBridgeRefreshDeps } from './auth-bridge-refresh';
import { AuthBridgeRefresh } from './auth-bridge-refresh';
import { useAuthClientPort } from './auth-client-provider';
import { useConfigService } from './config-service-context';
import { SessionBearerTokenResolver } from './resolve-session-bearer-token';
import { originRevalidate } from './session-revalidate-on-origin';
import { SignOutIntentContext, signOutIntentOf } from './sign-out-intent';
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

  createEffect(
    () => ({ authState: args.authState(), deps: args.deps() }),
    ({ authState, deps }) => {
      const isSignedIn = isAuthSessionSignedIn(authState);
      const externalUserId = authState.session?.externalUserId ?? null;
      if (!authState.isHydrated) return;
      if (!isSignedIn || externalUserId === null) {
        if (!isSignedIn) previousExternalUserIdRef.current = null;
        return;
      }
      const stored = new SessionCapabilityStore(
        deps.store
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
      deps.lastSyncedTokenRef.current = null;
      void writeSecureStorageItem(deps.store, LAST_LOCAL_ACCOUNT_ID_KEY, null);
    }
  );
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

  createEffect(
    () => ({
      hydrated: args.tokenHydrated() && args.accountIdHydrated(),
      deps: args.deps(),
    }),
    ({ hydrated, deps }) => {
      if (!hydrated || bootedRef.current) return;
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
    }
  );
}

async function reconcileAuthSession(args: {
  signedIn: boolean;
  expiresAt: string | null;
  externalUserId: string | null;
  sessionError: Error | null;
  deps: AuthBridgeRefreshDeps;
  port: AuthClientPort;
  wasBaSignedInRef: { current: boolean };
}): Promise<void> {
  const { deps, wasBaSignedInRef } = args;
  if (args.sessionError !== null) {
    deps.log.warn('auth session error', { error: args.sessionError.message });
  }
  if (!args.signedIn) {
    const storedToken = new SessionCapabilityStore(deps.store).readToken();
    const rotateAccount = wasBaSignedInRef.current || storedToken !== null;
    const clear = shouldClearCapabilityOnBaSignedOut({
      storedToken,
      wasBaSignedIn: wasBaSignedInRef.current,
    });
    wasBaSignedInRef.current = false;
    if (clear) {
      // The provider ended a session this device still held.
      await new AuthBridgeRefresh(deps).handleSignedOut({
        rotateAccount,
        endedElsewhere: storedToken !== null,
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
    expiresAt: args.expiresAt,
    externalUserId: args.externalUserId,
  });
}

function useReconcileAuthSession(args: {
  authState: Accessor<AuthSessionState>;
  port: AuthClientPort;
  deps: Accessor<AuthBridgeRefreshDeps>;
}): void {
  const wasBaSignedInRef = { current: false };
  const chainRef = { current: Promise.resolve() };

  createEffect(
    () => ({ authState: args.authState(), deps: args.deps() }),
    ({ authState, deps }) => {
      if (!authState.isHydrated) return;
      const next = {
        signedIn: isAuthSessionSignedIn(authState),
        expiresAt: normalizeExpiresAt(authState.session?.expiresAt ?? null),
        externalUserId: authState.session?.externalUserId ?? null,
        sessionError: authSessionError(authState),
      };
      chainRef.current = chainRef.current
        .catch(() => undefined)
        .then(() =>
          reconcileAuthSession({
            ...next,
            deps,
            port: args.port,
            wasBaSignedInRef,
          })
        );
    }
  );
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
  createEffect(
    () => args.enabled(),
    (enabled) => {
      if (!enabled) return;
      return subscribeToForeground(() => {
        void (async () => {
          const deps = args.deps();
          const token = await new SessionBearerTokenResolver(
            deps.timers
          ).resolve(args.port);
          if (token === null) return;
          await new AuthBridgeRefresh(deps).runRefresh({
            token,
            expiresAt: args.expiresAt(),
            externalUserId: args.externalUserId(),
            force: true,
          });
        })();
      });
    }
  );
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
  const origin = useOptionalOriginAvailability();
  createEffect(
    () => args.enabled(),
    (enabled) => {
      if (!enabled) return;
      // regression: privacy-proof-unknown-after-reopen
      // A reopened app knows its session only from storage. Ask the server as
      // soon as it can be reached, not a minute from now: until it answers, the
      // device cannot tell when the person last signed in, and choices that
      // need a recent sign-in (export, deletion) are refused as if they had not.
      const boot = new AbortController();
      if (!args.port.session.getSnapshot().isHydrated) {
        void hydrateSessionWhenReachable(args.port, origin, boot.signal);
      }
      const id = timers.setInterval(() => {
        void args.port.session.refresh();
      }, SESSION_REVALIDATE_MS);
      return () => {
        boot.abort();
        timers.clearInterval(id);
      };
    }
  );
}

async function hydrateSessionWhenReachable(
  port: AuthClientPort,
  origin: ReturnType<typeof useOptionalOriginAvailability>,
  signal: AbortSignal
): Promise<void> {
  try {
    await origin?.waitUntilAvailable(signal);
  } catch {
    return;
  }
  if (signal.aborted || port.session.getSnapshot().isHydrated) return;
  await port.session.refresh();
}

/** The minute interval is the backstop. A returning connection asks at once. */
function useRevalidateSessionWhenOriginReturns(args: {
  enabled: Accessor<boolean>;
  port: AuthClientPort;
  origin: ReturnType<typeof useOptionalOriginAvailability>;
}): void {
  createEffect(
    () => args.enabled(),
    (enabled) => {
      const origin = args.origin;
      if (!enabled || origin === undefined || origin.kind !== 'health') {
        return;
      }
      let sawUnavailable = false;
      return origin.subscribe(() => {
        const next = originRevalidate(
          sawUnavailable,
          origin.getSnapshot().phase
        );
        sawUnavailable = next.sawUnavailable;
        if (!next.revalidate) return;
        void args.port.session.refresh();
      });
    }
  );
}

/**
 * Reconciles local session capability (`sessionToken` + meta) with identity
 * refresh. IdP `useSession` is a ceremony/reconcile trigger only —
 * chrome reads secure storage.
 */
export function AuthBridge(
  props: ParentProps<{
    /** See {@link AuthBridgeRefreshDeps.countUnshared}. */
    readonly countUnshared?: (accountId: string) => Promise<number | null>;
  }>
): JSX.Element {
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
  const log = useLogger('auth-bridge');
  const timers = useTimers();
  const createId = useCreateId();
  const lastSyncedTokenRef = { current: null as string | null };
  const inFlightRef = { current: false };
  const pendingTokenRef = { current: null as string | null };
  const signingInTokenRef = { current: null as string | null };
  const signOutIntentRef = { current: false };

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
    signOutIntentRef,
    countUnshared: props.countUnshared,
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
  // A saved session without a local account still needs to recover when the
  // connection returns. Waiting for the account here would deadlock boot.
  const refreshEnabled = createMemo(() => authToken() !== null);
  useRefreshOnAppForeground({
    enabled: refreshEnabled,
    port,
    expiresAt,
    externalUserId,
    deps,
  });
  useRevalidateSession({ enabled: refreshEnabled, port });
  useRevalidateSessionWhenOriginReturns({
    enabled: refreshEnabled,
    port,
    origin: originAvailability,
  });

  return (
    <SignOutIntentContext value={signOutIntentOf(signOutIntentRef)}>
      {props.children}
    </SignOutIntentContext>
  );
}
