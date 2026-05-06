import { Box, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';

import type { SpaceMemberRow } from './types';

export type MemberPresenceBadgesProps = {
  member: SpaceMemberRow;
  sessionCount: number;
  thisTab: boolean;
  isYou: boolean;
};

export function MemberPresenceBadges({
  member,
  sessionCount,
  thisTab,
  isYou,
}: MemberPresenceBadgesProps) {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 1,
        alignItems: 'center',
      }}
    >
      {sessionCount > 1 ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={`·${String(sessionCount)}`}
        />
      ) : null}
      {isYou ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={<Trans>You</Trans>}
        />
      ) : null}
      {thisTab ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={<Trans>This tab</Trans>}
        />
      ) : null}
      {member.role === 'host' ? (
        <Text
          variant="caption"
          sx={{ color: 'textSecondary' }}
          label={<Trans>Host</Trans>}
        />
      ) : null}
    </Box>
  );
}
