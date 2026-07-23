import { useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { SpaceGuestSection } from '../members/space-guest-section';
import { useSpaceColumn, SpaceField } from '../use-space-column';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from './space-card-gradient';
import { SpaceCardOpenLink } from './space-card-open-link';
import { SpaceSummaryHeader } from './space-summary-header';

export type SpaceCardProps = {
  spaceId: string;
};

/** Live lobby card — ended spaces are omitted so they disappear immediately. */
export function SpaceCard({ spaceId }: SpaceCardProps): ReactNode {
  const theme = useTheme();
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  if (endedAt !== null) {
    return null;
  }
  return (
    <SpaceCardOpenLink spaceId={spaceId}>
      <SpaceCardGradientBox
        sx={{
          borderRadius: SPACE_CARD_BORDER_RADIUS,
          p: 4,
          minHeight: 112,
          justifyContent: 'space-between',
        }}
        style={theme.elevation(1)}
      >
        <SpaceSummaryHeader spaceId={spaceId} />
        <SpaceGuestSection spaceId={spaceId} />
      </SpaceCardGradientBox>
    </SpaceCardOpenLink>
  );
}
