import { assertDeviceId } from '@gamezilla/domain/auth/device-id';
import { assert } from '@gamezilla/lib/assert';
import type { PatchDb, PatchDbContext } from '@gamezilla/patch-db/interface';
import type {
  AppAuthContext,
  AppClientContext,
} from '../patch-db/abac-policies';
import { buildAppAuthContextFromBearer } from './bearer-resolve';
import { loadMemberOfSpaceIds } from './member-of-spaces';
import type { AuthSessionPort, HttpBearerAuthPorts } from './ports';
import type { AuthContext } from './types';
import { UnauthorizedError } from './unauthorized-error';

export type { AuthContext } from './types';

/** HTTP header: install id for patch-db device binding (UUID). Required with Bearer session. */
export const ANON_ID_HEADER = 'x-anon-id';

const UNAUTH_CLIENT_CONTEXT: AppClientContext = {};

export type SessionAuthDeps = HttpBearerAuthPorts;

async function buildAnonAppAuthContext(
  db: PatchDb,
  anonId: string
): Promise<AppAuthContext> {
  assertDeviceId(anonId);
  const memberOfSpaceIds = await loadMemberOfSpaceIds(db, anonId);
  return {
    deviceId: anonId,
    accountId: null,
    myId: anonId,
    memberOfSpaceIds,
    friendUserIds: [],
    blockedUserIds: [],
  } satisfies AppAuthContext;
}

export function createSessionAuth(deps: SessionAuthDeps): AuthSessionPort {
  const bearerAuth = deps;

  /**
   * Token-only request resolution. Session JWT in `Authorization: Bearer …` plus
   * {@link ANON_ID_HEADER} (install UUID) for `deviceId`; or anonymous
   * {@link AppAuthContext} when only `x-anon-id` is set; or unauthenticated
   * marker when neither applies.
   */
  async function resolvePatchDbContext(
    db: PatchDb,
    request: Request
  ): Promise<PatchDbContext> {
    const header = request.headers.get('Authorization');
    const anonRaw = request.headers.get(ANON_ID_HEADER)?.trim() ?? '';

    if (header === null || !header.startsWith('Bearer ')) {
      if (anonRaw.length > 0) {
        return await buildAnonAppAuthContext(db, anonRaw);
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
    if (typeof ctx.deviceId !== 'string') {
      throw new UnauthorizedError('Invalid or expired session');
    }
    const auth = ctx as AppAuthContext;
    if (auth.accountId === null) {
      throw new UnauthorizedError('Invalid or expired session');
    }
    return auth as AuthContext;
  }

  return { resolvePatchDbContext, requireAuthContext };
}
