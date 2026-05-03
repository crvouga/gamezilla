import {
  PRINCIPAL_SESSION_ENTITY_TYPE,
  PrincipalSessionAttr,
} from '@gamezilla/domain/auth';
import { assertPrincipalId } from '@gamezilla/domain/auth/principal-id';
import { assert } from '@gamezilla/lib/assert';
import type { PatchDb, PatchDbContext } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';
import type {
  AppAuthContext,
  AppVisitorContext,
} from '../patch-db/default-patch-db-policies';
import { UnauthorizedError } from './unauthorized-error';

export type AuthContext = AppAuthContext;

/**
 * Resolves a request to either a full auth context (when Bearer is valid)
 * or a visitor context (when only a visitorId cookie is available).
 * Returns a visitor context instead of null so the ABAC layer can filter
 * reads for anonymous visitors.
 */
export async function resolvePatchDbContext(
  db: PatchDb,
  request: Request,
  visitorId: string
): Promise<PatchDbContext> {
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) {
    return { visitorId } satisfies AppVisitorContext;
  }
  const token = header.slice('Bearer '.length).trim();
  assert.ok(token.length > 0, 'Bearer token must be non-empty');

  const [result] = await db.read(
    [
      {
        entityType: PRINCIPAL_SESSION_ENTITY_TYPE,
        where: {
          type: '=',
          attribute: PrincipalSessionAttr.token,
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
    const principalId = entity.attributes[PrincipalSessionAttr.principalId];
    const accountId = entity.attributes[PrincipalSessionAttr.accountId];
    const expiresAtRaw = entity.attributes[PrincipalSessionAttr.expiresAt];

    if (typeof principalId !== 'string' || typeof accountId !== 'string') {
      continue;
    }
    assertPrincipalId(principalId);

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
      visitorId,
      principalId,
      accountId,
      memberOfSpaceIds: [],
      friendAccountIds: [],
      blockedAccountIds: [],
    } satisfies AppAuthContext;
  }

  return { visitorId } satisfies AppVisitorContext;
}

/**
 * Same as {@link resolvePatchDbContext} but throws 401 when there is no
 * valid Bearer session. Use for endpoints that require authentication.
 */
export async function requireAuthContext(
  db: PatchDb,
  request: Request,
  visitorId: string
): Promise<AuthContext> {
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const ctx = await resolvePatchDbContext(db, request, visitorId);
  if (typeof ctx.principalId !== 'string') {
    throw new UnauthorizedError('Invalid or expired session');
  }
  return ctx as AuthContext;
}
