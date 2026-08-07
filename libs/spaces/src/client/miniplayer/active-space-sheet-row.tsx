import { Box, CONTENT_EDGE_PADDING_STEP, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import type { RequestEndSpaceOptions } from '../end-space/end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from '../leave-space/leave-space-modal-provider';

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
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

/** Horizontal inset inside the sheet list (above the surface edge pad). */
const ROW_EDGE_PADDING_STEP = CONTENT_EDGE_PADDING_STEP + 2;

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
        gap: 3,
        minHeight: 72,
        // Use `borderColor` (resolved by sx) — `borderBottomColor: 'border'` is
        // passed through as the literal string and falls back to currentColor.
        borderBottomWidth: 'hairline',
        borderColor: 'border',
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
            pl: ROW_EDGE_PADDING_STEP,
            py: 3,
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
      <Box sx={{ pr: ROW_EDGE_PADDING_STEP, pl: 1 }}>
        <SpaceEndOrLeaveButton
          spaceId={spaceId}
          requestEndSpace={requestEndSpace}
          requestLeaveSpace={requestLeaveSpace}
        />
      </Box>
    </Box>
  );
}
