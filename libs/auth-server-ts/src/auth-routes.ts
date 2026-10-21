import type { ApiHonoEnv } from '@libs/auth-shared-ts/api-hono-env';
import { BearerAuthResolver } from '@libs/auth-shared-ts/bearer-resolve';
import { ANON_ID_HEADER } from '@libs/auth-shared-ts/session-middleware';
import type { AuthContext } from '@libs/auth-shared-ts/types';
import { UnauthorizedError } from '@libs/auth-shared-ts/unauthorized-error';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { isUuid } from '@pkgs/uuid-shared-ts/uuid';
import { Hono } from 'hono';
import { EnsureAnonUserUseCase } from './ensure-anon-user-use-case';
import { AuthSnapshotRefresher } from './refresh-auth-snapshot';

type RefreshBody = {
  device: Record<string, string | null>;
};

type AnonEnsureBody = {
  forceNew: boolean;
  userId?: string;
};

/** Writable device metadata columns accepted by `POST /identity/refresh`. */
const DEVICE_SNAPSHOT_COLUMNS = new Set([
  'platform',
  'os_name',
  'os_version',
  'device_model_name',
  'device_brand',
  'device_name',
  'app_version',
  'app_build_number',
  'user_agent',
]);

/**
 * Keeps only known device column keys with non-empty string values. We
 * filter so a hostile or buggy client cannot smuggle unrelated columns
 * into the device row through this endpoint.
 */
function parseDeviceAttributes(raw: unknown): Record<string, string | null> {
  if (raw === null || typeof raw !== 'object') return {};
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!DEVICE_SNAPSHOT_COLUMNS.has(key)) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    out[key] = trimmed;
  }
  return out;
}

function readRefreshBody(raw: unknown): RefreshBody {
  const obj =
    raw === null || typeof raw !== 'object'
      ? {}
      : (raw as Record<string, unknown>);
  return {
    device: parseDeviceAttributes(obj['device']),
  };
}

function readAnonEnsureBody(raw: unknown): AnonEnsureBody {
  const obj =
    raw === null || typeof raw !== 'object'
      ? {}
      : (raw as Record<string, unknown>);
  const userId = obj['userId'];
  return {
    forceNew: obj['forceNew'] === true,
    ...(typeof userId === 'string' && isUuid(userId) ? { userId } : {}),
  };
}

function requireDeviceId(header: string | undefined): string {
  const deviceId = header?.trim() ?? '';
  if (deviceId.length === 0) {
    throw new UnauthorizedError('Missing x-anon-id for device binding');
  }
  return deviceId;
}

function requireBearerToken(header: string | null): string {
  if (header === null || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const bearerToken = header.slice('Bearer '.length).trim();
  if (bearerToken.length === 0) {
    throw new UnauthorizedError('Missing bearer token');
  }
  return bearerToken;
}

/**
 * Domain identity routes (outside IdP’s `/api/auth/*` namespace):
 * - `POST /identity/anon/ensure` — mint/bind anon `users` row for the install
 * - `POST /identity/refresh` — upgrade-or-switch on provider sign-in
 */
export class AuthApiRoutes {
  constructor(
    private readonly clock: Clock,
    private readonly createId: CreateId,
    private readonly onUserDomainWrite?: (
      userIds: readonly string[]
    ) => void | Promise<void>
  ) {}

  build() {
    const resolved = { clock: this.clock, createId: this.createId };
    return new Hono<ApiHonoEnv<AuthContext>>()
      .post('/identity/anon/ensure', async (c) => {
        const sql = c.get('sqlClient');
        const deviceId = requireDeviceId(c.req.header(ANON_ID_HEADER));

        const rawBody: unknown = await c.req.json().catch(() => null);
        const body = readAnonEnsureBody(rawBody);

        const result = await new EnsureAnonUserUseCase(sql, resolved).execute({
          deviceId,
          forceNew: body.forceNew,
          ...(body.userId !== undefined ? { userId: body.userId } : {}),
        });

        await this.onUserDomainWrite?.([
          result.userId,
          ...result.leftAccountIds,
        ]);

        return c.json(
          { userId: result.userId, accountId: result.userId, isAnon: true },
          200
        );
      })
      .post('/identity/refresh', async (c) => {
        const sql = c.get('sqlClient');
        const authServer = c.get('authServer');
        const bearerToken = requireBearerToken(
          c.req.header('Authorization') ?? null
        );
        const deviceId = requireDeviceId(c.req.header(ANON_ID_HEADER));

        const accountId = await new BearerAuthResolver(
          sql,
          authServer,
          resolved
        ).resolveAccountId(bearerToken, deviceId);
        if (accountId === null) {
          throw new UnauthorizedError('Invalid or expired session');
        }

        const rawBody: unknown = await c.req.json().catch(() => null);
        const body = readRefreshBody(rawBody);

        const leftAccountIds = await new AuthSnapshotRefresher(
          sql,
          authServer
        ).refresh({
          bearerToken,
          accountId,
          deviceId,
          deviceAttributes: body.device,
          now: resolved.clock.now,
          createId: resolved.createId,
        });

        await this.onUserDomainWrite?.([accountId, ...leftAccountIds]);

        return c.json({ accountId, userId: accountId, isAnon: false }, 200);
      });
  }
}
