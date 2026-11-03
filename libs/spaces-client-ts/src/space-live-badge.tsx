import type { JSX } from 'solid-js';
import { SpaceBadgeView } from './space-card-view';
import { useIsSpaceOpenLocally } from './use-open-space-session-ids';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type SpaceLiveBadgeProps = {
  spaceId: string;
};

/**
 * Status tag for one space — "Current" when this device has the space open
 * (miniplayer), otherwise the LIVE tag while the space has not ended.
 */
export function SpaceLiveBadge(props: SpaceLiveBadgeProps): JSX.Element {
  const endedAt = useSpaceColumn(props.spaceId, SpaceField.endedAt);
  const isOpen = useIsSpaceOpenLocally(props.spaceId);
  return (
    <SpaceBadgeView
      badge={endedAt() !== null ? 'none' : isOpen() ? 'current' : 'live'}
    />
  );
}
