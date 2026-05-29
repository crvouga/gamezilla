import { SpaceHostNameText } from '../members/space-host-name-text';
import type { ReactNode } from 'react';

export type MiniplayerHostNameLineProps = {
  spaceId: string;
};

/** Host display-name line inside a miniplayer card. */
export function MiniplayerHostNameLine({
  spaceId,
}: MiniplayerHostNameLineProps): ReactNode {
  return (
    <SpaceHostNameText
      spaceId={spaceId}
      variant="caption"
      sx={{ flexShrink: 1 }}
      numberOfLines={1}
    />
  );
}
