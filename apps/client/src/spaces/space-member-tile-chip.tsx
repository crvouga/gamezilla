import { DeviceAvatar } from '@gamezilla/client/profile/device-avatar';
import { Box, StatusDot, Text } from '@gamezilla/lib/ui';

import { MemberPresenceBadges } from './space-member-presence-badges';
import type { SpaceMemberRow } from './types';

export type SpaceMemberTileChipProps = {
  member: SpaceMemberRow;
  online: boolean;
  sessionCount: number;
  thisTab: boolean;
  isYou: boolean;
};

export function SpaceMemberTileChip({
  member,
  online,
  sessionCount,
  thisTab,
  isYou,
}: SpaceMemberTileChipProps) {
  return (
    <Box
      sx={{
        alignItems: 'center',
        gap: 1,
        borderRadius: 12,
        px: 2,
        py: 1,
        minWidth: 56,
        borderWidth: thisTab ? 2 : 0,
        borderColor: thisTab ? 'primary' : 'transparent',
      }}
    >
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
        {online ? <StatusDot status="online" size={8} /> : null}
        <DeviceAvatar
          avatarConfig={member.avatarConfig}
          seedFallback={member.memberId}
          size={36}
        />
      </Box>
      <Text variant="caption" numberOfLines={1} label={member.displayName} />
      <MemberPresenceBadges
        member={member}
        sessionCount={sessionCount}
        thisTab={thisTab}
        isYou={isYou}
      />
    </Box>
  );
}
