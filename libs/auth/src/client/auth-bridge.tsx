import { useLogger } from '@pkgs/logger/react';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { writeSecureStorageItem } from '@pkgs/secure-storage/use-secure-storage-item';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuthClient, type SessionSnapshot } from './auth-client-provider';
import {
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from './auth-storage-keys';
import { collectDeviceSnapshot } from './collect-device-snapshot';
import { useConfigService } from './config-service-context';
import { refreshAuth } from './refresh-auth-fetch';
import { useCurrentAccountId } from './use-current-account-id';
import { useDeviceId } from './use-device-id';
import { useSessionToken } from './use-session-token';

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

function isSnapshotSignedIn(snapshot: SessionSnapshot): boolean {
  return (
    (snapshot.error === null || snapshot.error === undefined) &&
    snapshot.data !== null &&
    snapshot.data !== undefined
  );
}

function normalizeToken(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function normalizeExpiresAt(raw: unknown): string | null {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return null;
}

function getSessionRecord(
  snapshot: SessionSnapshot
): { token?: unknown; expiresAt?: unknown } | null {
  if (!isSnapshotSignedIn(snapshot)) return null;
  const data = snapshot.data as {
    session?: { token?: unknown; expiresAt?: unknown };
  };
  return data.session ?? null;
}

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
  const session = getSessionRecord(snapshot);
  return {
    token: normalizeToken(session?.token),
    expiresAt: normalizeExpiresAt(session?.expiresAt),
  };
}

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
    // eslint-disable-next-line lingui/no-unlocalized-strings -- React Native AppState event name.
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
export function AuthBridge(props: PropsWithChildren): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const authClient = useAuthClient();
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

  useReconcileBetterAuthSession({
    snapshot,
    token,
    expiresAt,
    deps,
  });
  useRefreshOnAppForeground({
    enabled: sessionToken !== null && currentAccountId !== null,
    tokenRef,
    expiresAtRef,
    deps,
  });

  return props.children;
}

async function handleSignedIn(args: {
  deps: RefreshDeps;
  token: string;
  expiresAt: string | null;
}): Promise<void> {
  const { deps, token, expiresAt } = args;
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
