import type { AuthServerPort } from '@pkgs/auth-root-shared-ts/auth-server-port';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { assertUuid } from '@pkgs/uuid-shared-ts/uuid';
import { AnonUserService } from './anon-user-service';
import type { AppAuthContext } from './auth-context';
import { buildAppAuthContext } from './auth-context';
import { assertDeviceId } from './device-id';
import { EnsureInternalAccountUseCase } from './ensure-internal-account-use-case';
import { sessionTelemetryPopulation } from './session-telemetry-population';

const ACCOUNT_CACHE_TTL_MS = 60_000;
const ACCOUNT_CACHE_MAX = 128;
type AccountCacheEntry = { readonly accountId: string; readonly exp: number };
type AccountCache = Map<string, AccountCacheEntry>;
const accountIdCaches = new WeakMap<SqlClient, AccountCache>();

function cacheFor(db: SqlClient): AccountCache {
  let cache = accountIdCaches.get(db);
  if (cache === undefined) {
    cache = new Map();
    accountIdCaches.set(db, cache);
  }
  return cache;
}

function accountCacheKey(deviceId: string, externalUserId: string): string {
  return `${deviceId}\0${externalUserId}`;
}

function readCachedAccountId(
  cache: AccountCache,
  key: string,
  now: () => number
): string | null {
  const hit = cache.get(key);
  if (hit === undefined) return null;
  if (hit.exp <= now()) {
    cache.delete(key);
    return null;
  }
  return hit.accountId;
}

function writeCachedAccountId(
  cache: AccountCache,
  key: string,
  accountId: string,
  now: () => number
): void {
  if (cache.size >= ACCOUNT_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, {
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
    const cache = cacheFor(this.sql);
    const cached = readCachedAccountId(cache, cacheKey, this.time.clock.now);
    if (cached !== null) {
      const live = await this.sql.query(
        sql<
          Record<string, unknown>
        >`SELECT id FROM auth_users WHERE id = ${cached} AND deleted_at IS NULL`
      );
      return live.length > 0 ? cached : null;
    }

    const upgradeUserId = await new AnonUserService(
      this.sql,
      this.time
    ).findUserIdByDeviceId(deviceId);

    const synthetic = await sessionTelemetryPopulation(this.sql, session);
    const accountId = await new EnsureInternalAccountUseCase(
      this.sql,
      this.time,
      this.authServer
    ).execute({
      externalUserId: session.externalUserId,
      ...(synthetic === undefined ? {} : { synthetic }),
      upgradeUserId,
    });
    if (accountId !== null) {
      const live = await this.sql.query(
        sql<
          Record<string, unknown>
        >`SELECT id FROM auth_users WHERE id = ${accountId} AND deleted_at IS NULL`
      );
      if (live.length === 0) return null;
      writeCachedAccountId(cache, cacheKey, accountId, this.time.clock.now);
    }
    return accountId;
  }

  async buildAppAuthContext(
    bearerToken: string,
    deviceId: string
  ): Promise<AppAuthContext | null> {
    const accountId = await this.resolveAccountId(bearerToken, deviceId);
    if (accountId === null) return null;
    const session = await this.authServer.verifySessionToken(
      bearerToken.trim()
    );
    if (session === null) return null;
    assertDeviceId(deviceId);
    const synthetic = await sessionTelemetryPopulation(this.sql, session);
    return buildAppAuthContext({
      deviceId,
      accountId,
      myId: accountId,
      isAnon: false,
      ...(synthetic === undefined ? {} : { synthetic }),
      ...(session.authenticatedAt === null
        ? {}
        : { authenticatedAtMs: session.authenticatedAt.getTime() }),
    });
  }
}
