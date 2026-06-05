import { MiniplayerHostNameLine } from './miniplayer-host-name-line';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MiniplayerMemberCountText } from './miniplayer-member-count-text';
import { MiniplayerOpenSpacePressable } from './miniplayer-open-space-pressable';
import { MiniplayerSpaceTitle } from './miniplayer-space-title';
import { SpaceEndOrLeaveButton } from '../lifecycle/space-end-or-leave-button';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from '../card/space-card-gradient';
import { Box, elevation, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

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
        borderRadius: SPACE_CARD_BORDER_RADIUS,
        flexDirection: 'row',
        alignItems: 'center',
        p: 3,
        gap: 2,
        minHeight: 72,
      }}
      style={elevation(2)}
    >
      <MiniplayerOpenSpacePressable spaceId={spaceId}>
        <Box
          sx={{
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
      <SpaceEndOrLeaveButton spaceId={spaceId} />
    </SpaceCardGradientBox>
  );
}
