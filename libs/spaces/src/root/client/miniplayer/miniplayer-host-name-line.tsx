import type { ReactNode } from 'react';
import { SpaceHostNameText } from '../members/space-host-name-text';

export type MiniplayerHostNameLineProps = {
  spaceId: string;
};

/** Host username line inside a miniplayer card. */
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
