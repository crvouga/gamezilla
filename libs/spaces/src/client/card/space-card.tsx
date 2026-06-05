import { Box, elevation } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { SpaceGuestSection } from '../members/space-guest-section';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import { SpaceHostNameText } from '../members/space-host-name-text';
import { SpaceLiveBadge } from '../space-live-badge';
import { SpaceTitleText } from '../space-title-text';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from './space-card-gradient';
import { SpaceCardOpenLink } from './space-card-open-link';

export type SpaceCardProps = {
  spaceId: string;
};

const HOST_AVATAR_SIZE = 44;

/**
 * Pure layout: gradient surface, host header, live badge, guest section.
 * Every visible field comes from an id-driven atom; no `useQuery` here.
 */
export function SpaceCard({ spaceId }: SpaceCardProps): ReactNode {
  return (
    <SpaceCardOpenLink spaceId={spaceId}>
      <SpaceCardGradientBox
        sx={{
          borderRadius: SPACE_CARD_BORDER_RADIUS,
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
                numberOfLines={1}
              />
              <SpaceHostNameText spaceId={spaceId} variant="caption" />
            </Box>
          </Box>
          <SpaceLiveBadge spaceId={spaceId} />
        </Box>
        <SpaceGuestSection spaceId={spaceId} />
      </SpaceCardGradientBox>
    </SpaceCardOpenLink>
  );
}
