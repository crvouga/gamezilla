import { Hono } from 'hono';
import { ensureAnonUserForDevice } from './anon-user-ensure';
import type { ApiHonoEnv } from './api-hono-env';
import { resolveAccountIdFromBearer } from './bearer-resolve';
import { refreshAuthSnapshot } from './refresh-auth-snapshot';
import { ANON_ID_HEADER } from './session-middleware';
import type { AuthContext } from './types';
import { UnauthorizedError } from './unauthorized-error';

type RefreshBody = {
  device: Record<string, string | null>;
};

type AnonEnsureBody = {
  forceNew: boolean;
};

/** Writable device metadata columns accepted by `POST /auth/refresh`. */
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
  return {
    forceNew: obj['forceNew'] === true,
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
 * Auth routes:
 * - `POST /auth/anon/ensure` — mint/bind anon `users` row for the install
 * - `POST /auth/refresh` — upgrade-or-switch on provider sign-in
 */
export function createAuthApiRoutes(deps?: {
  readonly onUserDomainWrite?: (userId: string) => void;
}) {
  return new Hono<ApiHonoEnv<AuthContext>>()
    .post('/auth/anon/ensure', async (c) => {
      const sql = c.get('sqlClient');
      const deviceId = requireDeviceId(c.req.header(ANON_ID_HEADER));

      const rawBody: unknown = await c.req.json().catch(() => null);
      const body = readAnonEnsureBody(rawBody);

      const result = await ensureAnonUserForDevice({
        sql,
        deviceId,
        forceNew: body.forceNew,
      });

      deps?.onUserDomainWrite?.(result.userId);

      return c.json(
        { userId: result.userId, accountId: result.userId, isAnon: true },
        200
      );
    })
    .post('/auth/refresh', async (c) => {
      const sql = c.get('sqlClient');
      const authServer = c.get('authServer');
      const bearerToken = requireBearerToken(
        c.req.header('Authorization') ?? null
      );
      const deviceId = requireDeviceId(c.req.header(ANON_ID_HEADER));

      const accountId = await resolveAccountIdFromBearer({
        sql,
        authServer,
        bearerToken,
        deviceId,
      });
      if (accountId === null) {
        throw new UnauthorizedError('Invalid or expired session');
      }

      const rawBody: unknown = await c.req.json().catch(() => null);
      const body = readRefreshBody(rawBody);

      await refreshAuthSnapshot({
        sql,
        authServer,
        bearerToken,
        accountId,
        deviceId,
        deviceAttributes: body.device,
      });

      deps?.onUserDomainWrite?.(accountId);

      return c.json({ accountId, userId: accountId, isAnon: false }, 200);
    });
}
