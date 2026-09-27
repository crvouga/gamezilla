/**
 * Minimal framework-free identity boot for the Solid shell. Establishes the
 * local `users.id` that scopes SQLite **without** waiting on the network:
 *
 * 1. ensure a per-install `deviceId`;
 * 2. reuse `lastLocalAccountId`, or mint one locally (fresh install);
 * 3. in the background, reconcile with the API: `POST /identity/refresh` when
 *    a bearer is stored, else `POST /identity/anon/ensure`. A fresh install
 *    adopts the server's id; an existing install keeps its local id.
 *
 * Storage writes go through `SecureStorageStore`, so identity-aware readers
 * (`useLocalIdentity`) observe changes reactively. Sign-in / sign-out flows
 * (Phase 5 auth port) write the same keys.
 */

import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_EXPIRES_AT_KEY,
  SESSION_EXTERNAL_USER_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth/public/auth-storage-keys';
import { ensureAnonAuth } from '@libs/auth/root/client/ensure-anon-auth-fetch';
import {
  isUnauthorizedRefreshError,
  refreshAuth,
} from '@libs/auth/root/client/refresh-auth-fetch';
import type { HttpFetch } from '@pkgs/http-client/types';
import type { SecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import type { CreateId } from '@pkgs/uuid/create-id';

export type LocalIdentity = {
  readonly deviceId: string;
  readonly userId: string;
  readonly sessionToken: string | null;
};

export type IdentityBootDeps = {
  readonly store: SecureStorageStore;
  readonly createId: CreateId;
  readonly fetchFn: HttpFetch;
  readonly apiUrl: string;
  readonly waitUntilAvailable?:
    | ((signal?: AbortSignal | null) => Promise<void>)
    | undefined;
  readonly log?:
    | { readonly warn: (msg: string, meta?: Record<string, unknown>) => void }
    | undefined;
};

function nonEmpty(value: string | null): string | null {
  return value !== null && value.length > 0 ? value : null;
}

async function ensureStoredId(
  store: SecureStorageStore,
  key: string,
  createId: CreateId
): Promise<{ readonly value: string; readonly minted: boolean }> {
  const stored = await store.hydrate(key);
  const existing = nonEmpty(stored);
  if (existing !== null) return { value: existing, minted: false };
  const minted = createId();
  await store.write(key, minted);
  return { value: minted, minted: true };
}

export type LocalIdentityBoot = LocalIdentity & {
  /** True when `userId` was minted by this boot (no prior local account). */
  readonly freshInstall: boolean;
};

/** Local-only: never touches the network. Resolves once SQLite can open. */
export async function bootLocalIdentity(
  deps: Pick<IdentityBootDeps, 'store' | 'createId'>
): Promise<LocalIdentityBoot> {
  const device = await ensureStoredId(deps.store, DEVICE_ID_KEY, deps.createId);
  const storedToken = await deps.store.hydrate(SESSION_TOKEN_KEY);
  const sessionToken = nonEmpty(storedToken);
  const account = await ensureStoredId(
    deps.store,
    LAST_LOCAL_ACCOUNT_ID_KEY,
    deps.createId
  );
  return {
    deviceId: device.value,
    userId: account.value,
    sessionToken,
    freshInstall: account.minted,
  };
}

async function clearSession(store: SecureStorageStore): Promise<void> {
  await store.write(SESSION_TOKEN_KEY, null);
  await store.write(SESSION_EXPIRES_AT_KEY, null);
  await store.write(SESSION_EXTERNAL_USER_ID_KEY, null);
}

function readWebUserAgent(): Record<string, string> {
  const ua = (globalThis as { navigator?: { userAgent?: unknown } }).navigator
    ?.userAgent;
  return typeof ua === 'string' && ua.length > 0
    ? { 'device/user_agent': ua, 'device/platform': 'web' }
    : { 'device/platform': 'web' };
}

async function reconcileAnon(
  deps: IdentityBootDeps,
  identity: LocalIdentityBoot
): Promise<void> {
  const result = await ensureAnonAuth({
    apiUrl: deps.apiUrl,
    deviceId: identity.deviceId,
    fetchFn: deps.fetchFn,
    userId: identity.userId,
  });
  // A bearer landed while ensure was in flight: refresh owns the account id.
  if (nonEmpty(deps.store.getValue(SESSION_TOKEN_KEY)) !== null) return;
  if (result.userId === identity.userId) return;
  if (!identity.freshInstall) return;
  await deps.store.write(LAST_LOCAL_ACCOUNT_ID_KEY, result.userId);
}

async function reconcileSignedIn(
  deps: IdentityBootDeps,
  identity: LocalIdentityBoot,
  token: string
): Promise<void> {
  try {
    const { accountId } = await refreshAuth({
      apiUrl: deps.apiUrl,
      bearerToken: token,
      deviceId: identity.deviceId,
      fetchFn: deps.fetchFn,
      deviceSnapshot: readWebUserAgent(),
    });
    if (nonEmpty(deps.store.getValue(SESSION_TOKEN_KEY)) !== token) return;
    if (accountId !== deps.store.getValue(LAST_LOCAL_ACCOUNT_ID_KEY)) {
      await deps.store.write(LAST_LOCAL_ACCOUNT_ID_KEY, accountId);
    }
  } catch (error) {
    if (!isUnauthorizedRefreshError(error)) throw error;
    // Dead bearer: drop the session and continue as the local anon account.
    await clearSession(deps.store);
    await reconcileAnon(deps, identity);
  }
}

/**
 * Background reconcile with the API. Never throws: network failures leave
 * the local identity untouched (local-first) and are reported to `log`.
 */
export async function reconcileIdentityWithServer(
  deps: IdentityBootDeps,
  identity: LocalIdentityBoot
): Promise<void> {
  try {
    await deps.waitUntilAvailable?.();
    if (identity.sessionToken !== null) {
      await reconcileSignedIn(deps, identity, identity.sessionToken);
    } else {
      await reconcileAnon(deps, identity);
    }
  } catch (error) {
    deps.log?.warn('identity reconcile failed; staying local', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
