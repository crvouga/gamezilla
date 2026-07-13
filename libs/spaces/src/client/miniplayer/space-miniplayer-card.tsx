import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { SpaceCardGradientBox } from '../card/space-card-gradient';
import { SpaceEndOrLeaveButton } from './space-end-or-leave-button';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import { MiniplayerHostNameLine } from './miniplayer-host-name-line';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MiniplayerMemberCountText } from './miniplayer-member-count-text';
import { MiniplayerOpenSpacePressable } from './miniplayer-open-space-pressable';
import { MiniplayerSpaceTitle } from './miniplayer-space-title';

export type SpaceMiniplayerCardProps = {
  spaceId: string;
};

/** A single miniplayer entry — gradient + atoms. No `useQuery` here. */
export function SpaceMiniplayerCard({
  spaceId,
}: SpaceMiniplayerCardProps): ReactNode {
  return (
    <SpaceCardGradientBox
      sx={{
        borderRadius: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        minHeight: 72,
        elevation: 2,
      }}
    >
      <MiniplayerOpenSpacePressable spaceId={spaceId}>
        <Box
          sx={{
            p: 3,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            flex: 1,
            minWidth: 0,
          }}
        >
          <SpaceHostAvatar spaceId={spaceId} size={40} vividBackdrop />
          <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
            <MiniplayerSpaceTitle spaceId={spaceId} />
            <Box
              sx={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 1.5,
                minWidth: 0,
              }}
            >
              <MiniplayerHostNameLine spaceId={spaceId} />
              <Text
                variant="caption"
                // eslint-disable-next-line workspaceI18n/text-must-be-trans -- typographic separator
                label="·"
              />
              <MiniplayerMemberCountText spaceId={spaceId} />
            </Box>
          </Box>
        </Box>
        <MiniplayerLiveBadge />
      </MiniplayerOpenSpacePressable>
      <Box sx={{ pr: 3 }}>
        <SpaceEndOrLeaveButton spaceId={spaceId} />
      </Box>
    </SpaceCardGradientBox>
  );
}
