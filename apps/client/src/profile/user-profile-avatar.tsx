import { DeviceAvatar } from '@gamezilla/client/profile/device-avatar';
import { parseAvatarConfigAttrValue } from '@gamezilla/client/profile/profile-parsers';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type UserProfileAvatarProps = {
  /** Profile entity id (account or install id). `null` renders nothing. */
  profileId: string | null;
  size: number;
  vividBackdrop?: boolean;
};

/**
 * Avatar for any profile id. Reads `profile/avatarConfig` inline via
 * `useQueryAttribute`; falls back to a generic silhouette when no row exists.
 */
export function UserProfileAvatar({
  profileId,
  size,
  vividBackdrop,
}: UserProfileAvatarProps): ReactNode {
  if (profileId === null) return null;
  return (
    <UserProfileAvatarInner
      profileId={profileId}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}

function UserProfileAvatarInner({
  profileId,
  size,
  vividBackdrop,
}: {
  profileId: string;
  size: number;
  vividBackdrop: boolean;
}): ReactNode {
  const avatarConfig = useQueryAttribute({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: profileId,
    attributeKey: ProfileAttr.avatarConfig,
    attributeValue: parseAvatarConfigAttrValue,
  });
  return (
    <DeviceAvatar
      avatarConfig={avatarConfig}
      seedFallback={profileId}
      size={size}
      vividBackdrop={vividBackdrop}
    />
  );
}
