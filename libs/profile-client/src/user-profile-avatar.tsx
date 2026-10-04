import { parseAvatarConfig } from '@libs/profile-shared/avatar-config';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { DeviceAvatar } from './device-avatar';
import { useProfileColumn } from './use-profile-column';

export type UserProfileAvatarProps = {
  /** Profile entity id (account or install id). `null` renders nothing. */
  profileId: string | null;
  size: number;
  vividBackdrop?: boolean | undefined;
};

/**
 * Avatar for any profile id. Reads avatar_config inline; falls back to a
 * generic silhouette when no row exists.
 */
export function UserProfileAvatar(props: UserProfileAvatarProps): JSX.Element {
  const profileId = () => (props.profileId === null ? null : props.profileId);
  return (
    <Show when={profileId()} keyed>
      {(id) => (
        <UserProfileAvatarInner
          profileId={id}
          size={props.size}
          vividBackdrop={props.vividBackdrop ?? false}
        />
      )}
    </Show>
  );
}

function UserProfileAvatarInner(props: {
  profileId: string;
  size: number;
  vividBackdrop: boolean;
}): JSX.Element {
  const raw = useProfileColumn(() => props.profileId, 'avatarConfig');
  const avatarConfig = createMemo(() => parseAvatarConfig(raw()));
  return (
    <DeviceAvatar
      avatarConfig={avatarConfig()}
      seedFallback={props.profileId}
      size={props.size}
      vividBackdrop={props.vividBackdrop}
    />
  );
}
