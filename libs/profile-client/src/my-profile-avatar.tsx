import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { DeviceAvatar } from './device-avatar';
import { useMyProfileId } from './public-use-my-profile-id';
import { UserProfileAvatar } from './user-profile-avatar';

export type MyProfileAvatarProps = {
  size: number;
  vividBackdrop?: boolean | undefined;
};

/**
 * Sugar: `<UserProfileAvatar profileId={useMyProfileId()} … />`.
 * While SyncEngineBoot is sticky on a prior identity, shows a silhouette
 * instead of querying the wrong SQLite.
 */
export function MyProfileAvatar(props: MyProfileAvatarProps): JSX.Element {
  const { paintReady } = useSyncEngine();
  const profileId = useMyProfileId();
  return (
    <Show
      when={paintReady()}
      fallback={
        <DeviceAvatar
          avatarConfig={null}
          seedFallback="pending"
          size={props.size}
          vividBackdrop={props.vividBackdrop ?? false}
        />
      }
    >
      <Show when={profileId()} keyed>
        {(id) => (
          <UserProfileAvatar
            profileId={id}
            size={props.size}
            vividBackdrop={props.vividBackdrop ?? false}
          />
        )}
      </Show>
    </Show>
  );
}
