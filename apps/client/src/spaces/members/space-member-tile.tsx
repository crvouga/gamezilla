import { SpaceMemberTileChip } from '@gamezilla/client/spaces/space-member-tile-chip';
import { SpaceMemberTileRail } from '@gamezilla/client/spaces/space-member-tile-rail';
import type { ReactNode } from 'react';

export type SpaceMemberTileProps = {
  spaceId: string;
  profileId: string;
  variant: 'chip' | 'rail';
};

/** Variant-dispatched member tile (id-keyed). */
export function SpaceMemberTile({
  spaceId,
  profileId,
  variant,
}: SpaceMemberTileProps): ReactNode {
  if (variant === 'chip') {
    return <SpaceMemberTileChip spaceId={spaceId} profileId={profileId} />;
  }
  return <SpaceMemberTileRail spaceId={spaceId} profileId={profileId} />;
}
