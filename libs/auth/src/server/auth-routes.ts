import { Hono } from 'hono';

import { DEVICE_ENTITY_TYPE } from '@gamezilla/auth/shared';
import { resolveAccountIdFromBearer } from './bearer-resolve';
import { ANON_ID_HEADER } from './session-middleware';
import { refreshAuthSnapshot } from './refresh-auth-snapshot';
import { UnauthorizedError } from './unauthorized-error';
import type { ApiHonoEnv } from './api-hono-env';
import type { AuthContext } from './types';

type RefreshBody = {
  device: Record<string, string>;
  accountSessionExpiresAt: string;
};

const DEVICE_ATTR_PREFIX = `${DEVICE_ENTITY_TYPE}/`;

/**
 * Keeps only `device/...` attribute keys with non-empty string values. We
 * filter so a hostile or buggy client cannot smuggle unrelated attribute keys
 * into the device row through this endpoint.
 */
function parseDeviceAttributes(raw: unknown): Record<string, string> {
  if (raw === null || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.startsWith(DEVICE_ATTR_PREFIX)) continue;
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
  const expiresAtRaw = obj['accountSessionExpiresAt'];
  const expiresAt =
    typeof expiresAtRaw === 'string' && expiresAtRaw.length > 0
      ? expiresAtRaw
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return {
    device: parseDeviceAttributes(obj['device']),
    accountSessionExpiresAt: expiresAt,
  };
}

/**
 * Single client-facing auth endpoint. Validates the bearer + device pair,
 * upserts the canonical PatchDB snapshot for the current account / device,
 * and returns just `{ accountId }`. Clients read everything else (linked
 * providers, sessions, device metadata) from PatchDB after the next sync.
 *
 * Requires `Authorization: Bearer <jwt>` (Better Auth session JWT) and
 * `x-anon-id: <deviceId>` (install UUID).
 */
export function createAuthApiRoutes() {
  return new Hono<ApiHonoEnv<AuthContext>>().post(
    '/auth/refresh',
    async (c) => {
      const db = c.get('patchDb');
      const auth = c.get('betterAuth');

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
        db,
        auth,
        bearerToken,
        deviceId,
      });
      if (accountId === null) {
        throw new UnauthorizedError('Invalid or expired session');
      }

      const rawBody: unknown = await c.req.json().catch(() => null);
      const body = readRefreshBody(rawBody);

      await refreshAuthSnapshot({
        db,
        auth,
        bearerToken,
        accountId,
        deviceId,
        deviceAttributes: body.device,
        accountSessionExpiresAt: body.accountSessionExpiresAt,
      });

      return c.json({ accountId }, 200);
    }
  );
}
