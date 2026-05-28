import { MiniplayerHostNameLine } from './miniplayer-host-name-line';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MiniplayerMemberCountText } from './miniplayer-member-count-text';
import { MiniplayerOpenSpacePressable } from './miniplayer-open-space-pressable';
import { MiniplayerSpaceTitle } from './miniplayer-space-title';
import { SpaceEndOrLeaveButton } from '../lifecycle/space-end-or-leave-button';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import { Box, elevation, GradientBox, Text, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type SpaceMiniplayerCardProps = {
  spaceId: string;
};

/* eslint-disable-next-line lingui/no-unlocalized-strings -- color token */
const SEPARATOR_COLOR = 'rgba(255,255,255,0.55)';

const SPACE_CARD_RADIUS = 16;

/** A single miniplayer entry — gradient + atoms. No `useQuery` here. */
export function SpaceMiniplayerCard({
  spaceId,
}: SpaceMiniplayerCardProps): ReactNode {
  const theme = useTheme();
  const gradientColors = [
    theme.colors.tintHover,
    theme.colors.tintActive,
  ] as const;

  return (
    <GradientBox
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      sx={{
        borderRadius: SPACE_CARD_RADIUS,
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
                sx={{ color: SEPARATOR_COLOR }}
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
    </GradientBox>
  );
}
