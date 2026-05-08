import { MemberHostBadge } from '@gamezilla/client/spaces/members/member-host-badge';
import { MemberSessionCountBadge } from '@gamezilla/client/spaces/members/member-session-count-badge';
import { MemberThisTabBadge } from '@gamezilla/client/spaces/members/member-this-tab-badge';
import { MemberYouBadge } from '@gamezilla/client/spaces/members/member-you-badge';
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
