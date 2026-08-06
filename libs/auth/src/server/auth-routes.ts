import { Hono } from 'hono';

import { DEVICE_SNAPSHOT_COLUMNS } from '@libs/db/shared/auth-tables';
import { ensureAnonUserForDevice } from './anon-user-ensure';
import { resolveAccountIdFromBearer } from './bearer-resolve';
import { ANON_ID_HEADER } from './session-middleware';
import { refreshAuthSnapshot } from './refresh-auth-snapshot';
import { UnauthorizedError } from './unauthorized-error';
import type { ApiHonoEnv } from './api-hono-env';
import type { AuthContext } from './types';

type RefreshBody = {
  device: Record<string, string | null>;
};

type AnonEnsureBody = {
  forceNew: boolean;
};

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

/**
 * Auth routes:
 * - `POST /auth/anon/ensure` — mint/bind anon `users` row for the install
 * - `POST /auth/refresh` — upgrade-or-switch on provider sign-in
 */
export function createAuthApiRoutes() {
  return new Hono<ApiHonoEnv<AuthContext>>()
    .post('/auth/anon/ensure', async (c) => {
      const sql = c.get('sqlClient');
      const deviceId = c.req.header(ANON_ID_HEADER)?.trim() ?? '';
      if (deviceId.length === 0) {
        throw new UnauthorizedError('Missing x-anon-id for device binding');
      }

      const rawBody: unknown = await c.req.json().catch(() => null);
      const body = readAnonEnsureBody(rawBody);

      const result = await ensureAnonUserForDevice({
        sql,
        deviceId,
        forceNew: body.forceNew,
      });

      return c.json(
        { userId: result.userId, accountId: result.userId, isAnon: true },
        200
      );
    })
    .post('/auth/refresh', async (c) => {
      const sql = c.get('sqlClient');
      const authServer = c.get('authServer');

      const header = c.req.header('Authorization') ?? null;
      if (header === null || !header.startsWith('Bearer ')) {
        throw new UnauthorizedError('Missing bearer token');
      }
      const bearerToken = header.slice('Bearer '.length).trim();
      if (bearerToken.length === 0) {
        throw new UnauthorizedError('Missing bearer token');
      }
      const deviceId = c.req.header(ANON_ID_HEADER)?.trim() ?? '';
      if (deviceId.length === 0) {
        throw new UnauthorizedError('Missing x-anon-id for device binding');
      }

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

      return c.json({ accountId, userId: accountId, isAnon: false }, 200);
    });
}
