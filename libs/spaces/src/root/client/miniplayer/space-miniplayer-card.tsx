import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { SpaceCardGradientBox } from '../card/space-card-gradient';
import type { RequestEndSpaceOptions } from '../end-space/end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from '../leave-space/leave-space-modal-provider';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import { SpaceField, useSpaceColumn } from '../use-space-column';
import { MiniplayerHostNameLine } from './miniplayer-host-name-line';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MiniplayerMemberCountText } from './miniplayer-member-count-text';
import { MiniplayerOpenSpacePressable } from './miniplayer-open-space-pressable';
import { MiniplayerSpaceTitle } from './miniplayer-space-title';
import { SpaceEndOrLeaveButton } from './space-end-or-leave-button';

export type SpaceMiniplayerCardProps = {
  spaceId: string;
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

/** A single miniplayer entry — hidden once DB stamps `ended_at`. */
export function SpaceMiniplayerCard({
  spaceId,
  requestEndSpace,
  requestLeaveSpace,
}: SpaceMiniplayerCardProps): ReactNode {
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  // Treat only real timestamps as ended (empty/undefined → still live).
  const hide = endedAt != null && endedAt.length > 0;
  if (hide) {
    return null;
  }
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
            alignSelf: 'stretch',
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
              <Text variant="caption" label="·" />
              <MiniplayerMemberCountText spaceId={spaceId} />
            </Box>
          </Box>
        </Box>
        <MiniplayerLiveBadge />
      </MiniplayerOpenSpacePressable>
      <Box sx={{ pr: 3 }}>
        <SpaceEndOrLeaveButton
          spaceId={spaceId}
          requestEndSpace={requestEndSpace}
          requestLeaveSpace={requestLeaveSpace}
        />
      </Box>
    </SpaceCardGradientBox>
  );
}
