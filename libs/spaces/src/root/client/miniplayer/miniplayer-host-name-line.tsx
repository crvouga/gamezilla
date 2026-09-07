import type { JSX } from 'solid-js';

import { SpaceHostNameText } from '../members/space-host-name-text';

export type MiniplayerHostNameLineProps = {
  spaceId: string;
};

/** Host username line inside a miniplayer card. */
export function MiniplayerHostNameLine(
  props: MiniplayerHostNameLineProps
): JSX.Element {
  return (
    <SpaceHostNameText
      spaceId={props.spaceId}
      variant="caption"
      sx={{ flexShrink: 1 }}
      numberOfLines={1}
    />
  );
}
