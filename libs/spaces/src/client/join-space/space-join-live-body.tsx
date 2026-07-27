import { SpaceGuestSection } from '../members/space-guest-section';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from '../card/space-card-gradient';
import { SpaceSummaryHeader } from '../card/space-summary-header';
import { Box, Text } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceJoinLiveBodyProps = {
  spaceId: string;
};

/** Live (not joined) preview: summary card and helper copy. */
export function SpaceJoinLiveBody({
  spaceId,
}: SpaceJoinLiveBodyProps): ReactNode {
  return (
    <Box sx={{ gap: 4 }}>
      <SpaceCardGradientBox
        sx={{
          borderRadius: SPACE_CARD_BORDER_RADIUS,
          p: 4,
        }}
      >
        <SpaceSummaryHeader spaceId={spaceId} />
        <SpaceGuestSection spaceId={spaceId} />
      </SpaceCardGradientBox>
      <Text
        variant="body"
        sx={{ color: 'textSecondary' }}
        label={<Trans>Join to see who is here and hang out.</Trans>}
      />
    </Box>
  );
}
