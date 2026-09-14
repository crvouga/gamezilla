import type { JSX } from 'solid-js';

import { SpaceTitleText } from '../space-title-text';

export type MiniplayerSpaceTitleProps = {
  spaceId: string;
  class?: string;
};

/** Title row inside a miniplayer card. */
export function MiniplayerSpaceTitle(
  props: MiniplayerSpaceTitleProps
): JSX.Element {
  return (
    <SpaceTitleText
      spaceId={props.spaceId}
      variant="bodyBold"
      {...(props.class !== undefined ? { class: props.class } : {})}
      numberOfLines={1}
    />
  );
}
