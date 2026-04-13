import {
  PRINCIPAL_SESSION_ENTITY_TYPE,
  PrincipalSessionAttr,
} from '@gamezilla/shared/auth';
import { assertPrincipalId } from '@gamezilla/shared/auth/principal-id';
import { assert } from '@gamezilla/shared/assert';
import type { PatchesDb } from '@gamezilla/patch-db/interface';
import { UnauthorizedError } from './unauthorized-error';

export type AuthContext = {
  principalId: string;
  accountId: string;
};

/**
 * Resolves Bearer session token to principal + account via PatchDB.
 * Returns null if no/malformed Authorization header.
 * Never logs the raw token.
 */
export async function resolveAuthContext(
  db: PatchesDb,
  request: Request
): Promise<AuthContext | null> {
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  assert.ok(token.length > 0, 'Bearer token must be non-empty');

  const [result] = await db.read([
    {
      entityType: PRINCIPAL_SESSION_ENTITY_TYPE,
      where: {
        type: '=',
        attribute: PrincipalSessionAttr.token,
        value: token,
      },
      limit: 5,
    },
  ]);

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

    return { principalId, accountId };
  }

  return null;
}

/**
 * Same as {@link resolveAuthContext} but returns 401-style failure by throwing
 * if Authorization is present but session is missing or expired.
 */
export async function requireAuthContext(
  db: PatchesDb,
  request: Request
): Promise<AuthContext> {
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const ctx = await resolveAuthContext(db, request);
  if (ctx === null) {
    throw new UnauthorizedError('Invalid or expired session');
  }
  return ctx;
}
