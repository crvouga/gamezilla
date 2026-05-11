import { SpaceTitleText } from '../space-title-text';
import type { ReactNode } from 'react';

export type SpaceWideRailTitleTextProps = {
  spaceId: string;
};

/** Title text for the wide-rail header (single-line bodyBold). */
export function SpaceWideRailTitleText({
  spaceId,
}: SpaceWideRailTitleTextProps): ReactNode {
  return (
    <SpaceTitleText spaceId={spaceId} variant="bodyBold" numberOfLines={1} />
  );
}
