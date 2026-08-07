import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import type { ReactNode } from 'react';

import { DeviceAvatar } from './device-avatar';
import { useMyProfileId } from './use-my-profile-id';
import { UserProfileAvatar } from './user-profile-avatar';

export type MyProfileAvatarProps = {
  size: number;
  vividBackdrop?: boolean;
};

/**
 * Sugar: `<UserProfileAvatar profileId={useMyProfileId()} … />`.
 * While SyncEngineBoot is sticky on a prior identity, shows a silhouette
 * instead of querying the wrong SQLite.
 */
export function MyProfileAvatar({
  size,
  vividBackdrop,
}: MyProfileAvatarProps): ReactNode {
  const { paintReady } = useSyncEngine();
  const profileId = useMyProfileId();
  if (!paintReady) {
    return (
      <DeviceAvatar
        avatarConfig={null}
        seedFallback="pending"
        size={size}
        vividBackdrop={vividBackdrop ?? false}
      />
    );
  }
  return (
    <UserProfileAvatar
      profileId={profileId}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}
