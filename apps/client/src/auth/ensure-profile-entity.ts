import { assertDeviceId } from '@gamezilla/domain/auth';
import { assertUuid } from '@gamezilla/domain/auth/device-id';
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

/**
 * Ensures a `profile` row at `entityId === deviceId` (guest / device-local profile).
 */
export async function ensureDeviceProfile(
  db: PatchDb,
  deviceId: string
): Promise<void> {
  assertDeviceId(deviceId);
  const [res] = await db.read([
    {
      entityType: PROFILE_ENTITY_TYPE,
      entityId: deviceId,
      limit: 1,
    },
  ]);
  if (profileLooksPresent(res?.entities[0], deviceId)) return;
  const now = new Date().toISOString();
  await db.write([
    {
      entityId: deviceId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes: {
        [ProfileAttr.id]: deviceId,
        [ProfileAttr.createdAt]: now,
      },
    },
  ]);
}

/**
 * Ensures a `profile` row at `entityId === accountId` (signed-in account profile).
 */
export async function ensureAccountProfile(
  db: PatchDb,
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
