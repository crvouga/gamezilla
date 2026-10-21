import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { SpaceGuestAvatarGroup } from './space-guest-avatar-group';
import { SpaceGuestCountText } from './space-guest-count-text';
import { SpaceGuestMembershipUsernamesJoined } from './space-guest-membership-usernames-joined';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestSectionProps = {
  spaceId: string;
};

const AVATAR_SIZE = 24;
const AVATAR_GROUP_RING = 'surface' as const;
const AVATAR_MAX_VISIBLE = 6;

/**
 * Count line, avatar stack, and joined names for space-card guests.
 * Renders nothing when the space has no guests — no placeholder, no spacer.
 */
export function SpaceGuestSection(props: SpaceGuestSectionProps): JSX.Element {
  const membershipIds = useSpaceGuestMembershipIds(props.spaceId);
  return (
    <Show when={membershipIds().length > 0}>
      <StackVertical gap="sm">
        <SpaceGuestCountText spaceId={props.spaceId} />
        <SpaceGuestAvatarGroup
          spaceId={props.spaceId}
          size={AVATAR_SIZE}
          maxVisible={AVATAR_MAX_VISIBLE}
          ringColor={AVATAR_GROUP_RING}
        />
        <SpaceGuestMembershipUsernamesJoined spaceId={props.spaceId} />
      </StackVertical>
    </Show>
  );
}
