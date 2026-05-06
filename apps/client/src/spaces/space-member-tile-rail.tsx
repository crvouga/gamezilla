import { DeviceAvatar } from '@gamezilla/client/profile/device-avatar';
import { Box, StatusDot, Text } from '@gamezilla/lib/ui';

import { MemberPresenceBadges } from './space-member-presence-badges';
import type { SpaceMemberRow } from './types';

export type SpaceMemberTileRailProps = {
  member: SpaceMemberRow;
  online: boolean;
  sessionCount: number;
  thisTab: boolean;
  isYou: boolean;
};

export function SpaceMemberTileRail({
  member,
  online,
  sessionCount,
  thisTab,
  isYou,
}: SpaceMemberTileRailProps) {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        borderRadius: 10,
        px: 2,
        py: 2,
        borderWidth: thisTab ? 2 : 0,
        borderColor: thisTab ? 'primary' : 'transparent',
      }}
    >
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        {online ? <StatusDot status="online" size={8} /> : null}
        <DeviceAvatar
          avatarConfig={member.avatarConfig}
          seedFallback={member.memberId}
          size={40}
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text variant="body" numberOfLines={1} label={member.displayName} />
        <MemberPresenceBadges
          member={member}
          sessionCount={sessionCount}
          thisTab={thisTab}
          isYou={isYou}
        />
      </Box>
    </Box>
  );
}
