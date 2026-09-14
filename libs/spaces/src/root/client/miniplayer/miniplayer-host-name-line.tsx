import type { JSX } from 'solid-js';

import { SpaceHostNameText } from '../members/space-host-name-text';

export type MiniplayerHostNameLineProps = {
  spaceId: string;
  class?: string;
};

/** Host username line inside a miniplayer card. */
export function MiniplayerHostNameLine(
  props: MiniplayerHostNameLineProps
): JSX.Element {
  return (
    <div class="shrink min-w-[0]">
      <SpaceHostNameText
        spaceId={props.spaceId}
        variant="caption"
        {...(props.class !== undefined ? { class: props.class } : {})}
        numberOfLines={1}
      />
    </div>
  );
}
