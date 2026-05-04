import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import { assert } from '@gamezilla/lib/assert';
import type { Entity, PatchDb } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';

export type SignOutResult =
  | { status: 204 }
  | { status: 401; json: { error: string } };

const EPOCH_ISO = new Date(0).toISOString();

async function readSessionsByToken(
  db: PatchDb,
  token: string
): Promise<Entity[]> {
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
  return result?.entities ?? [];
}

/**
 * Server-authoritative session revoke. Idempotent: re-revoking an already
 * cleared row is a 204. Bypasses the `accountSession` ABAC policy by writing
 * with system context; the client never has to push revoke patches itself
 * (which would race with sign-out clearing the Bearer locally).
 *
 * @returns 204 when the bearer is unknown / already revoked (still safe — the
 *          client treats sign-out as authoritative locally); 401 only when no
 *          Bearer header is present.
 */
export async function handleSignOut(args: {
  db: PatchDb;
  bearer: string | null;
}): Promise<SignOutResult> {
  const { db, bearer } = args;
  if (bearer === null || bearer.length === 0) {
    return { status: 401, json: { error: 'Missing bearer token' } };
  }

  const entities = await readSessionsByToken(db, bearer);
  if (entities.length === 0) {
    return { status: 204 };
  }

  const writes = entities
    .filter((entity) => {
      const tok = entity.attributes[AccountSessionAttr.token];
      return typeof tok === 'string' && tok.length > 0;
    })
    .map((entity) => ({
      entityId: entity.entityId,
      entityType: ACCOUNT_SESSION_ENTITY_TYPE,
      attributes: {
        [AccountSessionAttr.token]: null,
        [AccountSessionAttr.expiresAt]: EPOCH_ISO,
      },
    }));

  if (writes.length === 0) {
    return { status: 204 };
  }

  const result = await db.write(writes, PATCHES_DB_SYSTEM_CONTEXT);
  assert.ok(
    result.rejected.length === 0,
    'system-context revoke must not be rejected',
    { rejected: result.rejected }
  );
  return { status: 204 };
}

export function parseBearerFromRequest(req: Request): string | null {
  const header = req.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}
