import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import type { PatchDb } from '@gamezilla/patch-db/interface';

/**
 * Updates display name and/or avatar on the profile row at `profileId`
 * (`deviceId` when guest, `userId` when signed in).
 */
export async function updateProfile(
  db: PatchDb,
  profileId: string,
  args: {
    displayName?: string;
    avatarConfig?: unknown;
  }
): Promise<void> {
  const attributes = {
    ...(args.displayName !== undefined
      ? ProfileAttr.displayName(args.displayName)
      : {}),
    ...(args.avatarConfig !== undefined
      ? ProfileAttr.avatarConfig(args.avatarConfig)
      : {}),
  };
  if (Object.keys(attributes).length === 0) return;
  await db.write([
    {
      entityId: profileId,
      entityType: PROFILE_ENTITY_TYPE,
      attributes,
    },
  ]);
}
