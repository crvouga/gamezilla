import { SpaceTitleText } from '../space-title-text';
import type { ReactNode } from 'react';

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
