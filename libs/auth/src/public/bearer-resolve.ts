import {
  type AppAuthContext,
  buildAppAuthContext,
} from '@libs/auth/public/auth-context';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { Clock } from '@pkgs/clock';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import { assertDeviceId, assertUuid } from '../shared/auth/device-id';

import { AnonUserService } from './anon-user-service';
import { EnsureInternalAccountUseCase } from './ensure-internal-account-use-case';

const ACCOUNT_CACHE_TTL_MS = 60_000;
const ACCOUNT_CACHE_MAX = 128;
type AccountCacheEntry = { readonly accountId: string; readonly exp: number };
const accountIdCache = new Map<string, AccountCacheEntry>();

function accountCacheKey(deviceId: string, externalUserId: string): string {
  return `${deviceId}\0${externalUserId}`;
}

function readCachedAccountId(key: string, now: () => number): string | null {
  const hit = accountIdCache.get(key);
  if (hit === undefined) return null;
  if (hit.exp <= now()) {
    accountIdCache.delete(key);
    return null;
  }
  return hit.accountId;
}

function writeCachedAccountId(
  key: string,
  accountId: string,
  now: () => number
): void {
  if (accountIdCache.size >= ACCOUNT_CACHE_MAX) {
    const oldest = accountIdCache.keys().next().value;
    if (oldest !== undefined) accountIdCache.delete(oldest);
  }
  accountIdCache.set(key, {
    accountId,
    exp: now() + ACCOUNT_CACHE_TTL_MS,
  });
}

/**
 * Validates the bearer token via the auth server port and resolves the internal
 * account id. JWT verification always runs; only the device/account SQL lookup
 * is cached briefly.
 */
export class BearerAuthResolver {
  constructor(
    private readonly sql: SqlClient,
    private readonly authServer: AuthServerPort,
    private readonly time: {
      readonly clock: Clock;
      readonly createId: CreateId;
    }
  ) {}

  async resolveAccountId(
    bearerToken: string,
    deviceId: string
  ): Promise<string | null> {
    assertUuid(deviceId, 'deviceId must be a valid UUID');
    const trimmed = bearerToken.trim();
    if (trimmed.length === 0) return null;

    const session = await this.authServer.verifySessionToken(trimmed);
    if (session === null) return null;

    const cacheKey = accountCacheKey(deviceId, session.externalUserId);
    const cached = readCachedAccountId(cacheKey, this.time.clock.now);
    if (cached !== null) return cached;

    const upgradeUserId = await new AnonUserService(
      this.sql,
      this.time
    ).findUserIdByDeviceId(deviceId);

    const accountId = await new EnsureInternalAccountUseCase(
      this.sql,
      this.time,
      this.authServer
    ).execute({
      externalUserId: session.externalUserId,
      upgradeUserId,
    });
    if (accountId !== null) {
      writeCachedAccountId(cacheKey, accountId, this.time.clock.now);
    }
    return accountId;
  }

  async buildAppAuthContext(
    bearerToken: string,
    deviceId: string
  ): Promise<AppAuthContext | null> {
    const accountId = await this.resolveAccountId(bearerToken, deviceId);
    if (accountId === null) return null;
    assertDeviceId(deviceId);
    return buildAppAuthContext({
      deviceId,
      accountId,
      myId: accountId,
      isAnon: false,
    });
  }
}
