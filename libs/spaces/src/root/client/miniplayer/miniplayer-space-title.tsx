import type { ReactNode } from 'react';
import { SpaceTitleText } from '../space-title-text';

export type MiniplayerSpaceTitleProps = {
  spaceId: string;
};

/** Title row inside a miniplayer card. */
export function MiniplayerSpaceTitle({
  spaceId,
}: MiniplayerSpaceTitleProps): ReactNode {
  return (
    <SpaceTitleText spaceId={spaceId} variant="bodyBold" numberOfLines={1} />
  );
}
