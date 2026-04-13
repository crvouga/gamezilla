import { PROFILE_ENTITY_TYPE } from '@gamezilla/shared/profile/profile-entities';
import { assertPrincipalId } from '@gamezilla/shared/auth';
import type { PatchesDb } from '@gamezilla/patch-db/interface';

/**
 * Ensures a `profile` entity exists for this principal (`entityId === principalId`).
 */
export async function ensureProfileEntity(
  db: PatchesDb,
  principalId: string
): Promise<void> {
  assertPrincipalId(principalId);

  const [res] = await db.read([
    {
      entityType: PROFILE_ENTITY_TYPE,
      entityId: principalId,
      limit: 1,
    },
  ]);
  const entity = res?.entities[0];
  if (entity !== undefined) {
    return;
  }

  await db.write([
    {
      entityId: principalId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: {},
    },
  ]);
}
