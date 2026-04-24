import {
  assertPrincipalId,
  PRINCIPAL_ENTITY_TYPE,
  PrincipalAttr,
} from '@gamezilla/domain/auth';
import type { PatchesDb } from '@gamezilla/patch-db/interface';

/**
 * Ensures a `principal` entity exists locally with id + createdAt (first launch).
 */
export async function ensurePrincipalEntity(
  db: PatchesDb,
  principalId: string
): Promise<void> {
  assertPrincipalId(principalId);

  const [res] = await db.read([
    {
      entityType: PRINCIPAL_ENTITY_TYPE,
      entityId: principalId,
      limit: 1,
    },
  ]);
  const entity = res?.entities[0];
  if (
    entity !== undefined &&
    entity.attributes[PrincipalAttr.id] === principalId &&
    typeof entity.attributes[PrincipalAttr.createdAt] === 'string'
  ) {
    return;
  }

  await db.write([
    {
      entityId: principalId,
      entityType: PRINCIPAL_ENTITY_TYPE,
      attributes: {
        [PrincipalAttr.id]: principalId,
        [PrincipalAttr.createdAt]: new Date().toISOString(),
      },
    },
  ]);
}
