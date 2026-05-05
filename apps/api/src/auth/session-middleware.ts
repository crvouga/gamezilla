import { AccountSessionAttr } from '@gamezilla/domain/auth';
import { assertDeviceId } from '@gamezilla/domain/auth/device-id';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { assert } from '@gamezilla/lib/assert';
import type { PatchDb, PatchDbContext } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import type {
  AppAuthContext,
  AppClientContext,
} from '../patch-db/abac-policies';
import { readAccountSessionsByToken } from './account-session-by-token';
import { UnauthorizedError } from './unauthorized-error';

export type AuthContext = AppAuthContext & { readonly accountId: string };

/** HTTP header: install id for unauthenticated patch-db clients (must match UUID device id). */
export const ANON_ID_HEADER = 'x-anon-id';

async function loadMemberOfSpaceIds(
  db: PatchDb,
  myId: string
): Promise<string[]> {
  const ids = new Set<string>();

  const [hosted] = await db.read(
    [
      {
        entityType: SPACE_ENTITY_TYPE,
        where: {
          type: 'and',
          clauses: [
            { type: '=', attribute: SpaceAttr.hostId, value: myId },
            { type: 'not_exists', attribute: SpaceAttr.endedAt },
          ],
        },
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  for (const e of hosted?.entities ?? []) {
    ids.add(e.entityId);
  }

  const [guestMem] = await db.read(
    [
      {
        entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
        where: {
          type: 'and',
          clauses: [
            { type: '=', attribute: SpaceMembershipAttr.guestId, value: myId },
            { type: 'not_exists', attribute: SpaceMembershipAttr.leftAt },
          ],
        },
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  for (const e of guestMem?.entities ?? []) {
    const sid = e.attributes[SpaceMembershipAttr.spaceId];
    if (typeof sid === 'string' && sid.length > 0) ids.add(sid);
  }

  return [...ids];
}

async function buildAnonAppAuthContext(
  db: PatchDb,
  clientId: string,
  anonId: string
): Promise<AppAuthContext> {
  assertDeviceId(anonId);
  const memberOfSpaceIds = await loadMemberOfSpaceIds(db, anonId);
  return {
    clientId,
    deviceId: anonId,
    accountId: null,
    myId: anonId,
    memberOfSpaceIds,
    friendUserIds: [],
    blockedUserIds: [],
  } satisfies AppAuthContext;
}

async function tryResolveBearerAppAuth(
  db: PatchDb,
  token: string,
  clientId: string
): Promise<AppAuthContext | null> {
  const entities = await readAccountSessionsByToken(db, token);
  const now = Date.now();

  for (const entity of entities) {
    const deviceId = entity.attributes[AccountSessionAttr.deviceId];
    const accountId = entity.attributes[AccountSessionAttr.accountId];
    const expiresAtRaw = entity.attributes[AccountSessionAttr.expiresAt];

    if (typeof deviceId !== 'string' || typeof accountId !== 'string') {
      continue;
    }
    assertDeviceId(deviceId);

    if (typeof expiresAtRaw !== 'string') {
      continue;
    }
    const exp = Date.parse(expiresAtRaw);
    assert.ok(!Number.isNaN(exp), 'session expiresAt must parse', {
      expiresAtRaw,
    });
    if (exp <= now) {
      continue;
    }

    const memberOfSpaceIds = await loadMemberOfSpaceIds(db, accountId);

    return {
      clientId,
      deviceId,
      accountId,
      myId: accountId,
      memberOfSpaceIds,
      friendUserIds: [],
      blockedUserIds: [],
    } satisfies AppAuthContext;
  }

  return null;
}

/**
 * Resolves a request to either a full auth context (when Bearer is valid)
 * or a client-only context (when only a clientId cookie is available).
 * When `x-anon-id` is set (valid device UUID) without Bearer, returns an auth-shaped
 * context with `myId` = that id and `accountId` = null.
 */
export async function resolvePatchDbContext(
  db: PatchDb,
  request: Request,
  clientId: string
): Promise<PatchDbContext> {
  const header = request.headers.get('Authorization');
  const anonRaw = request.headers.get(ANON_ID_HEADER)?.trim() ?? '';

  if (header === null || !header.startsWith('Bearer ')) {
    if (anonRaw.length > 0) {
      return await buildAnonAppAuthContext(db, clientId, anonRaw);
    }
    return { clientId } satisfies AppClientContext;
  }

  const token = header.slice('Bearer '.length).trim();
  assert.ok(token.length > 0, 'Bearer token must be non-empty');

  const auth = await tryResolveBearerAppAuth(db, token, clientId);
  return auth ?? ({ clientId } satisfies AppClientContext);
}

/**
 * Same as {@link resolvePatchDbContext} but throws 401 when there is no
 * valid Bearer session.
 */
export async function requireAuthContext(
  db: PatchDb,
  request: Request,
  clientId: string
): Promise<AuthContext> {
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const ctx = await resolvePatchDbContext(db, request, clientId);
  if (typeof ctx.deviceId !== 'string') {
    throw new UnauthorizedError('Invalid or expired session');
  }
  const auth = ctx as AppAuthContext;
  if (auth.accountId === null) {
    throw new UnauthorizedError('Invalid or expired session');
  }
  return auth as AuthContext;
}
