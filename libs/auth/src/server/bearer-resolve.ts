import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import {
  type AppAuthContext,
  buildAppAuthContext,
} from '@libs/auth/shared/auth-context';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { ensureInternalAccountIdForExternalUser } from './account-provisioning';
import { findUserIdByDeviceId } from './anon-user-ensure';

const ACCOUNT_CACHE_TTL_MS = 60_000;
const ACCOUNT_CACHE_MAX = 128;
type AccountCacheEntry = { readonly accountId: string; readonly exp: number };
const accountIdCache = new Map<string, AccountCacheEntry>();

function accountCacheKey(deviceId: string, externalUserId: string): string {
  return `${deviceId}\0${externalUserId}`;
}

function readCachedAccountId(key: string): string | null {
  const hit = accountIdCache.get(key);
  if (hit === undefined) return null;
  if (hit.exp <= Date.now()) {
    accountIdCache.delete(key);
    return null;
  }
  return hit.accountId;
}

function writeCachedAccountId(key: string, accountId: string): void {
  if (accountIdCache.size >= ACCOUNT_CACHE_MAX) {
    const oldest = accountIdCache.keys().next().value;
    if (oldest !== undefined) accountIdCache.delete(oldest);
  }
  accountIdCache.set(key, {
    accountId,
    exp: Date.now() + ACCOUNT_CACHE_TTL_MS,
  });
}

/**
 * Validates the bearer token via the auth server port and resolves the internal
 * account id, or `null` if verification fails.
 *
 * When the device is bound to an anon user and this external identity is new,
 * that anon row is upgraded in place.
 *
 * JWT verification always runs; only the device/account SQL lookup is cached
 * briefly (remote Postgres was ~800ms per mutations/query request).
 */
export async function resolveAccountIdFromBearer(args: {
  sql: SqlClient;
  authServer: AuthServerPort;
  bearerToken: string;
  deviceId: string;
}): Promise<string | null> {
  const { sql, authServer, bearerToken, deviceId } = args;
  assertUuid(deviceId, 'deviceId must be a valid UUID');
  const trimmed = bearerToken.trim();
  if (trimmed.length === 0) return null;

  const session = await authServer.verifySessionToken(trimmed);
  if (session === null) return null;

  const cacheKey = accountCacheKey(deviceId, session.externalUserId);
  const cached = readCachedAccountId(cacheKey);
  if (cached !== null) return cached;

  const upgradeUserId = await findUserIdByDeviceId(sql, deviceId);

  const accountId = await ensureInternalAccountIdForExternalUser({
    sql,
    authServer,
    externalUserId: session.externalUserId,
    upgradeUserId,
  });
  if (accountId !== null) writeCachedAccountId(cacheKey, accountId);
  return accountId;
}

export async function buildAppAuthContextFromBearer(args: {
  sql: SqlClient;
  authServer: AuthServerPort;
  bearerToken: string;
  deviceId: string;
}): Promise<AppAuthContext | null> {
  const { deviceId } = args;
  const accountId = await resolveAccountIdFromBearer(args);
  if (accountId === null) return null;
  assertDeviceId(deviceId);
  return buildAppAuthContext({
    deviceId,
    accountId,
    myId: accountId,
    isAnon: false,
  });
}
