import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import type {
  Entity,
  Patch,
  PatchDb,
  PatchDbResult,
} from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';

/**
 * Snapshot reads can miss a row that exists only as patches right after claim
 * (or before snapshot compaction catches up). Auth must still resolve the
 * server-issued bearer, so token lookups use `on: 'patches'` and fold patch
 * attributes when `entities` is empty.
 */
function entitiesFromSessionTokenResult(
  result: PatchDbResult | undefined
): Entity[] {
  if (result === undefined) return [];
  if (result.entities.length > 0) {
    return [...result.entities];
  }
  return foldSessionEntitiesFromPatches(result.patches);
}

function foldSessionEntitiesFromPatches(patches: readonly Patch[]): Entity[] {
  const byKey = new Map<
    string,
    { entityId: string; entityType: string; attrs: Record<string, unknown> }
  >();
  for (const p of patches) {
    const key = `${p.entityId}\0${p.entityType}`;
    const cur = byKey.get(key) ?? {
      entityId: p.entityId,
      entityType: p.entityType,
      attrs: {},
    };
    cur.attrs = { ...cur.attrs, ...p.attributes };
    byKey.set(key, cur);
  }
  return [...byKey.values()].map((v) => ({
    entityId: v.entityId,
    entityType: v.entityType,
    attributes: v.attrs,
  }));
}

export async function readAccountSessionsByToken(
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
        on: 'patches',
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  return entitiesFromSessionTokenResult(result);
}
