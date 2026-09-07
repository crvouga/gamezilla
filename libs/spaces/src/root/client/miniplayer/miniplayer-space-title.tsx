import type { JSX } from 'solid-js';

import { SpaceTitleText } from '../space-title-text';

export type MiniplayerSpaceTitleProps = {
  spaceId: string;
};

/** Title row inside a miniplayer card. */
export function MiniplayerSpaceTitle(
  props: MiniplayerSpaceTitleProps
): JSX.Element {
  return (
    <SpaceTitleText
      spaceId={props.spaceId}
      variant="bodyBold"
      numberOfLines={1}
    />
  );
}
