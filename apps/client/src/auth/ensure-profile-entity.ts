import { assertPrincipalId } from '@gamezilla/domain/auth';
import { assertUuid } from '@gamezilla/domain/auth/principal-id';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import type { Entity, PatchesDb } from '@gamezilla/patch-db/interface';

function profileLooksPresent(
  entity: Entity | undefined,
  expectedId: string
): boolean {
  if (entity === undefined) return false;
  const attrs = entity.attributes as Record<string, unknown>;
  return (
    attrs[ProfileAttr.id] === expectedId &&
    typeof attrs[ProfileAttr.createdAt] === 'string'
  );
}

/**
 * Ensures a `profile` row at `entityId === principalId` (guest / device-local profile).
 */
export async function ensurePrincipalProfile(
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
  if (profileLooksPresent(res?.entities[0], principalId)) return;
  const now = new Date().toISOString();
  await db.write([
    {
      entityId: principalId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: {
        [ProfileAttr.id]: principalId,
        [ProfileAttr.createdAt]: now,
      },
    },
  ]);
}

/**
 * Ensures a `profile` row at `entityId === accountId` (signed-in account profile).
 */
export async function ensureAccountProfile(
  db: PatchesDb,
  accountId: string
): Promise<void> {
  assertUuid(accountId, 'ensureAccountProfile accountId');
  const [res] = await db.read([
    {
      entityType: PROFILE_ENTITY_TYPE,
      entityId: accountId,
      limit: 1,
    },
  ]);
  if (profileLooksPresent(res?.entities[0], accountId)) return;
  const now = new Date().toISOString();
  await db.write([
    {
      entityId: accountId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: {
        [ProfileAttr.id]: accountId,
        [ProfileAttr.createdAt]: now,
      },
    },
  ]);
}
