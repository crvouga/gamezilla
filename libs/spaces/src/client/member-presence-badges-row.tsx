import { MemberHostBadge } from './member-host-badge';
import { MemberSessionCountBadge } from './member-session-count-badge';
import { MemberThisTabBadge } from './member-this-tab-badge';
import { MemberYouBadge } from './member-you-badge';
import { Box } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type MemberPresenceBadgesRowProps = {
  spaceId: string;
  profileId: string;
};

/** Wrapped row of presence badges (each badge self-gates). */
export function MemberPresenceBadgesRow({
  spaceId,
  profileId,
}: MemberPresenceBadgesRowProps): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 1,
        alignItems: 'center',
      }}
    >
      <MemberSessionCountBadge spaceId={spaceId} profileId={profileId} />
      <MemberYouBadge profileId={profileId} />
      <MemberThisTabBadge spaceId={spaceId} profileId={profileId} />
      <MemberHostBadge spaceId={spaceId} profileId={profileId} />
    </Box>
  );
}
