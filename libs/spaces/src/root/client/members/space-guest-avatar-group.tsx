import { AvatarGroup } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

import { SpaceGuestMembershipAvatar } from './space-guest-membership-avatar';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestAvatarGroupProps = {
  spaceId: string;
  size: number;
  maxVisible: number;
  ringColor?: string;
};

/** Stacked guest avatars for a space, keyed by membership id. */
export function SpaceGuestAvatarGroup(
  props: SpaceGuestAvatarGroupProps
): JSX.Element {
  const membershipIds = useSpaceGuestMembershipIds(props.spaceId);
  return (
    <Show when={membershipIds().length > 0}>
      <AvatarGroup
        size={props.size}
        maxVisible={props.maxVisible}
        ringColor={props.ringColor}
      >
        <For each={membershipIds()}>
          {(mid) => (
            <SpaceGuestMembershipAvatar membershipId={mid} size={props.size} />
          )}
        </For>
      </AvatarGroup>
    </Show>
  );
}
