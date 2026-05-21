import { SpaceCardOpenLink } from './space-card-open-link';
import { SpaceGuestSection } from '../members/space-guest-section';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import { SpaceHostNameText } from '../members/space-host-name-text';
import { SpaceLiveBadge } from '../space-live-badge';
import { SpaceTitleText } from '../space-title-text';
import { Box, elevation, GradientBox, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';

export type SpaceCardProps = {
  spaceId: string;
};

/* eslint-disable lingui/no-unlocalized-strings -- color tokens, not user-facing copy */
const TITLE_COLOR = '#FFFFFF';
const SUBTITLE_COLOR = 'rgba(255,255,255,0.85)';
/* eslint-enable lingui/no-unlocalized-strings */

const HOST_AVATAR_SIZE = 44;
const SPACE_CARD_RADIUS = 16;

/**
 * Pure layout: gradient surface, host header, live badge, guest section.
 * Every visible field comes from an id-driven atom; no `useQuery` here.
 */
export function SpaceCard({ spaceId }: SpaceCardProps): ReactNode {
  const theme = useTheme();
  const gradientColors = [
    theme.colors.gradientPrimaryStart,
    theme.colors.gradientPrimaryEnd,
  ] as const;

  return (
    <SpaceCardOpenLink spaceId={spaceId}>
      <GradientBox
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        sx={{
          borderRadius: SPACE_CARD_RADIUS,
          p: 4,
          minHeight: 112,
          justifyContent: 'space-between',
        }}
        style={elevation(1)}
      >
        <Box sx={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Box
            sx={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              flex: 1,
            }}
          >
            <SpaceHostAvatar
              spaceId={spaceId}
              size={HOST_AVATAR_SIZE}
              vividBackdrop
            />
            <Box sx={{ flex: 1, gap: 0.5 }}>
              <SpaceTitleText
                spaceId={spaceId}
                variant="bodyBold"
                sx={{ color: TITLE_COLOR }}
                numberOfLines={1}
              />
              <SpaceHostNameText
                spaceId={spaceId}
                variant="caption"
                sx={{ color: SUBTITLE_COLOR }}
              />
            </Box>
          </Box>
          <SpaceLiveBadge spaceId={spaceId} />
        </Box>
        <SpaceGuestSection spaceId={spaceId} />
      </GradientBox>
    </SpaceCardOpenLink>
  );
}
