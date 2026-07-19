import { useTheme } from '@pkgs/ui';
// #region agent log
import { useEffect } from 'react';
// #endregion
import type { ReactNode } from 'react';
import { SpaceGuestSection } from '../members/space-guest-section';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from './space-card-gradient';
import { SpaceCardOpenLink } from './space-card-open-link';
import { SpaceSummaryHeader } from './space-summary-header';

export type SpaceCardProps = {
  spaceId: string;
};

export function SpaceCard({ spaceId }: SpaceCardProps): ReactNode {
  const theme = useTheme();
  // #region agent log
  useEffect(() => {
    fetch(
      'http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '11af44',
        },
        body: JSON.stringify({
          sessionId: '11af44',
          hypothesisId: 'E',
          location: 'space-card.tsx:SpaceCard',
          message: 'SpaceCard mounted',
          data: { spaceId },
          timestamp: Date.now(),
        }),
      }
    ).catch(() => {});
  }, [spaceId]);
  // #endregion
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
