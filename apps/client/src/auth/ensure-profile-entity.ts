import { assertUuid } from '@gamezilla/domain/auth/device-id';
import { generateRandomDisplayName } from '@gamezilla/domain/profile/display-name-generator';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import type { Entity, PatchDb } from '@gamezilla/patch-db/interface';

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

function hasDisplayName(entity: Entity | undefined): boolean {
  if (entity === undefined) return false;
  const attrs = entity.attributes as Record<string, unknown>;
  const v = attrs[ProfileAttr.displayName];
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Ensures a `profile` row at `entityId === myId` (install id when anonymous,
 * account id when signed in).
 */
export async function ensureProfile(db: PatchDb, myId: string): Promise<void> {
  assertUuid(myId, 'ensureProfile myId');
  const [res] = await db.read([
    {
      entityType: PROFILE_ENTITY_TYPE,
      entityId: myId,
      limit: 1,
    },
  ]);
  const existing = res?.entities[0];
  if (profileLooksPresent(existing, myId)) {
    if (hasDisplayName(existing)) return;
    await db.write([
      {
        entityId: myId,
        entityType: PROFILE_ENTITY_TYPE,
        attributes: {
          [ProfileAttr.displayName]: generateRandomDisplayName(),
        },
      },
    ]);
    return;
  }
  const now = new Date().toISOString();
  await db.write([
    {
      entityId: myId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: {
        [ProfileAttr.id]: myId,
        [ProfileAttr.createdAt]: now,
        [ProfileAttr.displayName]: generateRandomDisplayName(),
      },
    },
  ]);
}
