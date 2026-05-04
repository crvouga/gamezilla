import { DeviceAvatar } from '@gamezilla/client/profile/device-avatar';
import { Box, StatusDot, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';

import { useSelfAuthIdentity } from './device-display-resolution';
import type { SpaceMemberRow } from './types';
import { useSpacePresence } from './use-space-presence';

export type SpaceMemberListProps = {
  members: SpaceMemberRow[];
};

export function SpaceMemberList({ members }: SpaceMemberListProps) {
  const { peersByAccountId, selfPeerId } = useSpacePresence();
  const { selfAccountId } = useSelfAuthIdentity();

  return (
    <Box sx={{ gap: 2 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label={<Trans>People here</Trans>}
      />
      <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {members.map((m) => {
          const peerIds = peersByAccountId.get(m.accountId) ?? [];
          const online = peerIds.length > 0;
          const sessionCount = peerIds.length;
          const thisTab =
            selfPeerId !== null &&
            peerIds.includes(selfPeerId) &&
            selfAccountId === m.accountId;

          return (
            <Box
              key={m.accountId}
              sx={{
                alignItems: 'center',
                gap: 1,
                borderRadius: 12,
                px: 1,
                py: 1,
                borderWidth: thisTab ? 2 : 0,
                borderColor: thisTab ? 'primary' : 'transparent',
              }}
            >
              <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                {online ? <StatusDot status="online" size={8} /> : null}
                <DeviceAvatar
                  avatarConfig={m.avatarConfig}
                  deviceId={m.accountId}
                  size={40}
                />
              </Box>
              <Text variant="caption" numberOfLines={1} label={m.displayName} />
              {sessionCount > 1 ? (
                <Text
                  variant="caption"
                  sx={{ color: 'textSecondary' }}
                  label={`·${String(sessionCount)}`}
                />
              ) : null}
              {thisTab ? (
                <Text
                  variant="caption"
                  sx={{ color: 'textSecondary' }}
                  label={<Trans>This tab</Trans>}
                />
              ) : null}
              {m.role === 'host' ? (
                <Text
                  variant="caption"
                  sx={{ color: 'textSecondary' }}
                  label={<Trans>Host</Trans>}
                />
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
