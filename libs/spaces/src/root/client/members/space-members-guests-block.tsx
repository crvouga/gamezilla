import { Trans } from '@lingui/solid/macro';
import { Box, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

import { SpaceGuestMembershipTileRail } from './space-guest-membership-tile-rail';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceMembersGuestsBlockProps = {
  spaceId: string;
};

/** Section showing each guest's tile, or a "no guests yet" placeholder. */
export function SpaceMembersGuestsBlock(
  props: SpaceMembersGuestsBlockProps
): JSX.Element {
  const membershipIds = useSpaceGuestMembershipIds(props.spaceId);
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', px: 2 }}
        label={<Trans>Guests</Trans>}
      />
      <Box sx={{ gap: 0 }}>
        <Show
          when={membershipIds().length > 0}
          fallback={
            <Text
              variant="caption"
              sx={{ color: 'textSecondary', px: 2 }}
              label={<Trans>No guests yet</Trans>}
            />
          }
        >
          <For each={membershipIds()}>
            {(mid) => (
              <SpaceGuestMembershipTileRail
                spaceId={props.spaceId}
                membershipId={mid}
              />
            )}
          </For>
        </Show>
      </Box>
    </Box>
  );
}
