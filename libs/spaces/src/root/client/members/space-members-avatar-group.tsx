import { AvatarGroup } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { For } from 'solid-js';

import { SpaceGuestMembershipAvatar } from './space-guest-membership-avatar';
import { SpaceHostAvatar } from './space-host-avatar';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceMembersAvatarGroupProps = {
  spaceId: string;
  /** Avatar diameter in px. Defaults to 36. */
  size?: number;
};

const DEFAULT_SIZE = 36;
const MAX_VISIBLE = 4;
const AVATAR_GROUP_RING = 'surface' as const;

/**
 * Stacked host + guest faces for space chrome. Press handling belongs on the
 * surrounding {@link IconButton} / ActionBar avatar item.
 */
export function SpaceMembersAvatarGroup(
  props: SpaceMembersAvatarGroupProps
): JSX.Element {
  const membershipIds = useSpaceGuestMembershipIds(props.spaceId);
  const size = () => props.size ?? DEFAULT_SIZE;

  return (
    <AvatarGroup
      size={size()}
      maxVisible={MAX_VISIBLE}
      ringColor={AVATAR_GROUP_RING}
    >
      <SpaceHostAvatar spaceId={props.spaceId} size={size()} />
      <For each={membershipIds()}>
        {(mid) => (
          <SpaceGuestMembershipAvatar membershipId={mid} size={size()} />
        )}
      </For>
    </AvatarGroup>
  );
}
