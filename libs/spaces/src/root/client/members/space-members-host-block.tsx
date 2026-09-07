import { Trans } from '@lingui/solid/macro';
import { Box, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { SpaceMemberTileRail } from './space-member-tile-rail';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceMembersHostBlockProps = {
  spaceId: string;
};

export function SpaceMembersHostBlock(
  props: SpaceMembersHostBlockProps
): JSX.Element {
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', px: 2 }}
        label={<Trans>Host</Trans>}
      />
      <Box sx={{ gap: 0 }}>
        <Show
          when={host()}
          keyed
          fallback={
            <Text
              variant="caption"
              sx={{ color: 'textSecondary', px: 2 }}
              label={<Trans>No host listed</Trans>}
            />
          }
        >
          {(entry) => (
            <SpaceMemberTileRail
              spaceId={props.spaceId}
              deviceId={entry.deviceId}
              profileId={entry.profileId}
              deviceLabel={entry.deviceLabel}
            />
          )}
        </Show>
      </Box>
    </Box>
  );
}
