import { SpaceTitleText } from '@gamezilla/client/spaces/host/space-title-text';
import type { ReactNode } from 'react';

export type MiniplayerSpaceTitleProps = {
  spaceId: string;
};

const TITLE_COLOR = '#FFFFFF';

/** Title row inside a miniplayer card. */
export function MiniplayerSpaceTitle({
  spaceId,
}: MiniplayerSpaceTitleProps): ReactNode {
  return (
    <SpaceTitleText
      spaceId={spaceId}
      variant="bodyBold"
      sx={{ color: TITLE_COLOR }}
      numberOfLines={1}
    />
  );
}
