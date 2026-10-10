import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { SpaceGuestAvatarGroup } from './space-guest-avatar-group';
import { SpaceGuestCountText } from './space-guest-count-text';
import { SpaceGuestNamesLine } from './space-guest-names-line';
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
      <div class="box mt-3 gap-1.5">
        <SpaceGuestCountText
          spaceId={props.spaceId}
          variant="caption"
          class="text-text-secondary"
        />
        <SpaceGuestAvatarGroup
          spaceId={props.spaceId}
          size={AVATAR_SIZE}
          maxVisible={AVATAR_MAX_VISIBLE}
          ringColor={AVATAR_GROUP_RING}
        />
        <SpaceGuestNamesLine
          spaceId={props.spaceId}
          variant="caption"
          class="text-text-secondary"
          numberOfLines={1}
        />
      </div>
    </Show>
  );
}
