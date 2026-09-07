import { Box } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { MemberHostBadge } from './member-host-badge';
import { MemberSessionCountBadge } from './member-session-count-badge';
import { MemberThisTabBadge } from './member-this-tab-badge';
import { MemberYouBadge } from './member-you-badge';

export type MemberPresenceBadgesRowProps = {
  spaceId: string;
  profileId: string;
};

/** Wrapped row of presence badges (each badge self-gates). */
export function MemberPresenceBadgesRow(
  props: MemberPresenceBadgesRowProps
): JSX.Element {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 1,
        alignItems: 'center',
      }}
    >
      <MemberSessionCountBadge
        spaceId={props.spaceId}
        profileId={props.profileId}
      />
      <MemberYouBadge profileId={props.profileId} />
      <MemberThisTabBadge spaceId={props.spaceId} profileId={props.profileId} />
      <MemberHostBadge spaceId={props.spaceId} profileId={props.profileId} />
    </Box>
  );
}
