import type { ReactNode } from 'react';

import { parseAvatarConfig } from './avatar-config';
import { DeviceAvatar } from './device-avatar';
import { useProfileColumn } from './use-profile-column';

export type UserProfileAvatarProps = {
  /** Profile entity id (account or install id). `null` renders nothing. */
  profileId: string | null;
  size: number;
  vividBackdrop?: boolean;
};

/**
 * Avatar for any profile id. Reads avatar_config inline; falls back to a
 * generic silhouette when no row exists.
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
  const raw = useProfileColumn(profileId, 'avatarConfig');
  const avatarConfig = parseAvatarConfig(raw);
  return (
    <DeviceAvatar
      avatarConfig={avatarConfig}
      seedFallback={profileId}
      size={size}
      vividBackdrop={vividBackdrop}
    />
  );
}
