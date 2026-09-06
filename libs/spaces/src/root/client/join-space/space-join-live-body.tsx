import { Trans } from '@lingui/react/macro';
import { Box, Text } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from '../../../root/client/card/space-card-gradient';
import { SpaceSummaryHeader } from '../../../root/client/card/space-summary-header';
import { SpaceGuestSection } from '../../../root/client/members/space-guest-section';

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
