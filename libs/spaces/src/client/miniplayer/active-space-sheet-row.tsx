import type { RequestEndSpaceOptions } from '../end-space/end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from '../leave-space/leave-space-modal-provider';
import { Box, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { SpaceHostAvatar } from '../members/space-host-avatar';
import { MiniplayerHostNameLine } from './miniplayer-host-name-line';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MiniplayerMemberCountText } from './miniplayer-member-count-text';
import { MiniplayerOpenSpacePressable } from './miniplayer-open-space-pressable';
import { MiniplayerSpaceTitle } from './miniplayer-space-title';
import { SpaceEndOrLeaveButton } from './space-end-or-leave-button';

export type ActiveSpaceSheetRowProps = {
  spaceId: string;
  onOpen: () => void;
  requestEndSpace: (
    spaceId: string,
    options?: RequestEndSpaceOptions
  ) => void;
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

/** One live space in the active-spaces sheet — open, end, or leave. */
export function ActiveSpaceSheetRow({
  spaceId,
  onOpen,
  requestEndSpace,
  requestLeaveSpace,
}: ActiveSpaceSheetRowProps): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        minHeight: 72,
        borderBottomWidth: 1,
        borderBottomColor: 'border',
      }}
    >
      <MiniplayerOpenSpacePressable spaceId={spaceId} onAfterOpen={onOpen}>
        <Box
          sx={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            flex: 1,
            minWidth: 0,
            px: 3,
            py: 2,
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
        <SpaceEndOrLeaveButton
          spaceId={spaceId}
          requestEndSpace={requestEndSpace}
          requestLeaveSpace={requestLeaveSpace}
        />
      </Box>
    </Box>
  );
}
