import { assertDeviceId } from '@gamezilla/auth/shared/device-id';
import { ANON_ID_HEADER } from '@gamezilla/api-types/auth-ports';
import {
  appAuth,
  type AppAuthContext,
  type AppClientContext,
  buildAppAuthContext,
} from '@gamezilla/auth/shared/auth-context';
import { assert } from '@gamezilla/lib/assert';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import { buildAppAuthContextFromBearer } from './bearer-resolve';
import type { AuthSessionPort, HttpBearerAuthPorts } from './ports';
import type { AuthContext } from './types';
import { UnauthorizedError } from './unauthorized-error';

export type { AuthContext } from './types';

/**
 * Re-export so existing imports (`@gamezilla/auth/server/session-middleware`)
 * keep working; the source of truth lives in `@gamezilla/api-types`.
 */
export { ANON_ID_HEADER };

const UNAUTH_CLIENT_CONTEXT: AppClientContext = {};

export type SessionAuthDeps = HttpBearerAuthPorts;

function buildAnonAppAuthContext(anonId: string): AppAuthContext {
  assertDeviceId(anonId);
  return buildAppAuthContext({
    deviceId: anonId,
    accountId: null,
    myId: anonId,
  });
}

export function createSessionAuth(deps: SessionAuthDeps): AuthSessionPort {
  const bearerAuth = deps;

  /**
   * Token-only request resolution. Session JWT in `Authorization: Bearer …` plus
   * {@link ANON_ID_HEADER} (install UUID) for `deviceId`; or anonymous
   * {@link AppAuthContext} when only `x-anon-id` is set; or unauthenticated
   * marker when neither applies.
   *
   * Domain-scoped claims (e.g. `spaces/member-of-space-ids`) are **not**
   * stamped here — they're attached lazily by their own packages via
   * patch-db `enrichContext` hooks, so this resolver stays free of
   * feature-package dependencies.
   */
  async function resolvePatchDbContext(
    db: PatchDb,
    request: Request
  ): Promise<Readonly<Record<string, unknown>>> {
    const header = request.headers.get('Authorization');
    const anonRaw = request.headers.get(ANON_ID_HEADER)?.trim() ?? '';

    if (header === null || !header.startsWith('Bearer ')) {
      if (anonRaw.length > 0) {
        return buildAnonAppAuthContext(anonRaw);
      }
      return UNAUTH_CLIENT_CONTEXT;
    }

    const token = header.slice('Bearer '.length).trim();
    assert.ok(token.length > 0, 'Bearer token must be non-empty');

    if (anonRaw.length === 0) {
      return UNAUTH_CLIENT_CONTEXT;
    }

    const auth = await buildAppAuthContextFromBearer({
      db,
      bearerAuth,
      bearerToken: token,
      deviceId: anonRaw,
    });
    return auth ?? UNAUTH_CLIENT_CONTEXT;
  }

  /**
   * Same as {@link resolvePatchDbContext} but throws 401 when there is no
   * valid session + device header.
   */
  async function requireAuthContext(
    db: PatchDb,
    request: Request
  ): Promise<AuthContext> {
    const header = request.headers.get('Authorization');
    if (header === null || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }
    const anonRaw = request.headers.get(ANON_ID_HEADER)?.trim() ?? '';
    if (anonRaw.length === 0) {
      throw new UnauthorizedError('Missing x-anon-id for device binding');
    }
    const ctx = await resolvePatchDbContext(db, request);
    const auth = appAuth(ctx);
    if (auth === null || auth.accountId === null) {
      throw new UnauthorizedError('Invalid or expired session');
    }
    return ctx as AuthContext;
  }

  return { resolvePatchDbContext, requireAuthContext };
}

export type SessionAuth = ReturnType<typeof createSessionAuth>;
