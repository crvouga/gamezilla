import { Plural } from '@lingui/solid/macro';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';

import { SpaceHostAvatar } from './space-host-avatar';
import { SpaceHostNameText } from './space-host-name-text';
import { SpaceTitleText } from './space-title-text';
import { useSpaceMemberCount } from './use-space-member-count';

export type MiniplayerSpaceSummaryProps = {
  spaceId: string;
};

const HOST_AVATAR_SIZE = 40;

/**
 * One live space at a glance inside the miniplayer and its sheet: the host's
 * face, the space title, then who hosts it and how many people are there.
 */
export function MiniplayerSpaceSummary(
  props: MiniplayerSpaceSummaryProps
): JSX.Element {
  const count = useSpaceMemberCount(props.spaceId);
  return (
    <StackHorizontal grow align="center" gap="md">
      <SpaceHostAvatar
        spaceId={props.spaceId}
        size={HOST_AVATAR_SIZE}
        vividBackdrop
      />
      <StackVertical grow>
        <SpaceTitleText spaceId={props.spaceId} variant="bodyBold" lines={1} />
        <StackHorizontal align="center" gap="sm">
          <StackVertical shrink>
            <SpaceHostNameText
              spaceId={props.spaceId}
              variant="caption"
              numberOfLines={1}
            />
          </StackVertical>
          <StackVertical>
            <P variant="caption" lines={1}>
              <Plural
                value={count()}
                one="# person here"
                other="# people here"
              />
            </P>
          </StackVertical>
        </StackHorizontal>
      </StackVertical>
    </StackHorizontal>
  );
}
