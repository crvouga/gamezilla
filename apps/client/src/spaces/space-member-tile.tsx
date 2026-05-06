import type { SpaceMemberRow } from './types';
import { SpaceMemberTileChip } from './space-member-tile-chip';
import { SpaceMemberTileRail } from './space-member-tile-rail';

export type SpaceMemberTileProps = {
  member: SpaceMemberRow;
  online: boolean;
  sessionCount: number;
  thisTab: boolean;
  isYou: boolean;
  variant: 'chip' | 'rail';
};

export function SpaceMemberTile({
  variant,
  ...rest
}: SpaceMemberTileProps) {
  if (variant === 'chip') {
    return <SpaceMemberTileChip {...rest} />;
  }
  return <SpaceMemberTileRail {...rest} />;
}
