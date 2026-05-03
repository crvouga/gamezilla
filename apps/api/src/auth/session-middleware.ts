import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import { assertDeviceId } from '@gamezilla/domain/auth/device-id';
import { assert } from '@gamezilla/lib/assert';
import type { PatchDb, PatchDbContext } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import type {
  AppAuthContext,
  AppClientContext,
} from '../patch-db/abac-policies';
import { UnauthorizedError } from './unauthorized-error';

export type AuthContext = AppAuthContext;

/**
 * Resolves a request to either a full auth context (when Bearer is valid)
 * or a client-only context (when only a clientId cookie is available).
 * Returns a client context instead of null so the ABAC layer can filter
 * reads for unauthenticated HTTP clients.
 */
export async function resolvePatchDbContext(
  db: PatchDb,
  request: Request,
  clientId: string
): Promise<PatchDbContext> {
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) {
    return { clientId } satisfies AppClientContext;
  }
  const token = header.slice('Bearer '.length).trim();
  assert.ok(token.length > 0, 'Bearer token must be non-empty');

  const [result] = await db.read(
    [
      {
        entityType: ACCOUNT_SESSION_ENTITY_TYPE,
        where: {
          type: '=',
          attribute: AccountSessionAttr.token,
          value: token,
        },
        limit: 5,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );

  const entities = result?.entities ?? [];
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

    return {
      clientId,
      deviceId,
      accountId,
      memberOfSpaceIds: [],
      friendUserIds: [],
      blockedUserIds: [],
    } satisfies AppAuthContext;
  }

  return { clientId } satisfies AppClientContext;
}

/**
 * Same as {@link resolvePatchDbContext} but throws 401 when there is no
 * valid Bearer session. Use for endpoints that require authentication.
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
  return ctx as AuthContext;
}
