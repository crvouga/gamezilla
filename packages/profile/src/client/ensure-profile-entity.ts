import { assertUuid } from '@gamezilla/lib/uuid';
import { serializeDefaultAvatarConfig } from '../shared/avatar-config';
import { generateRandomDisplayName } from '../shared/display-name-generator';
import { PROFILE_ENTITY_TYPE, ProfileAttr } from '../shared/profile-entities';
import type { Entity, PatchDb } from '@gamezilla/patch-db/interface';

function profileLooksPresent(
  entity: Entity | undefined,
  expectedId: string
): boolean {
  if (entity === undefined) return false;
  const attrs = entity.attributes as Record<string, unknown>;
  return (
    attrs[ProfileAttr.id.key] === expectedId &&
    typeof attrs[ProfileAttr.createdAt.key] === 'string'
  );
}

function hasDisplayName(entity: Entity | undefined): boolean {
  if (entity === undefined) return false;
  const attrs = entity.attributes as Record<string, unknown>;
  const v = attrs[ProfileAttr.displayName.key];
  return typeof v === 'string' && v.trim().length > 0;
}

function hasAvatarConfig(entity: Entity | undefined): boolean {
  if (entity === undefined) return false;
  const attrs = entity.attributes as Record<string, unknown>;
  const parsed = ProfileAttr.avatarConfig.from(attrs);
  return parsed !== null && parsed.seed.trim().length > 0;
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
    const patch = {
      ...(!hasDisplayName(existing)
        ? ProfileAttr.displayName(generateRandomDisplayName())
        : {}),
      ...(!hasAvatarConfig(existing)
        ? ProfileAttr.avatarConfig(serializeDefaultAvatarConfig(myId))
        : {}),
    };
    if (Object.keys(patch).length === 0) return;
    await db.write([
      {
        entityId: myId,
        entityType: PROFILE_ENTITY_TYPE,
        attributes: patch,
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
        ...ProfileAttr.id(myId),
        ...ProfileAttr.createdAt(now),
        ...ProfileAttr.displayName(generateRandomDisplayName()),
        ...ProfileAttr.avatarConfig(serializeDefaultAvatarConfig(myId)),
      },
    },
  ]);
}
