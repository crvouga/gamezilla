import { SpaceHostNameText } from '@gamezilla/client/spaces/host/space-host-name-text';
import type { ReactNode } from 'react';

export type MiniplayerHostNameLineProps = {
  spaceId: string;
};

/* eslint-disable-next-line lingui/no-unlocalized-strings -- color token */
const SUBTITLE_COLOR = 'rgba(255,255,255,0.85)';

/** Host display-name line inside a miniplayer card. */
export function MiniplayerHostNameLine({
  spaceId,
}: MiniplayerHostNameLineProps): ReactNode {
  return (
    <SpaceHostNameText
      spaceId={spaceId}
      variant="caption"
      sx={{ color: SUBTITLE_COLOR, flexShrink: 1 }}
      numberOfLines={1}
    />
  );
}
