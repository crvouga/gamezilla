import { Box } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import { SpaceHostNameText } from '../members/space-host-name-text';
import { SpaceEndedBadge } from '../space-ended-badge';
import { SpaceLiveBadge } from '../space-live-badge';
import { SpaceTitleText } from '../space-title-text';

export type SpaceSummaryHeaderProps = {
  spaceId: string;
  hostAvatarSize?: number;
};

const DEFAULT_HOST_AVATAR_SIZE = 44;

export function SpaceSummaryHeader({
  spaceId,
  hostAvatarSize = DEFAULT_HOST_AVATAR_SIZE,
}: SpaceSummaryHeaderProps): ReactNode {
  return (
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
          size={hostAvatarSize}
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
      <Box sx={{ gap: 1, alignItems: 'flex-end' }}>
        <SpaceLiveBadge spaceId={spaceId} />
        <SpaceEndedBadge spaceId={spaceId} />
      </Box>
    </Box>
  );
}
