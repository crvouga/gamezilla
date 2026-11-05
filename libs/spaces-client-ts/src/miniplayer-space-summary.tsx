import { Plural } from '@lingui/solid/macro';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

import { SpaceHostNameText } from './space-host-name-text';
import { SpaceMark } from './space-mark';
import { SpaceTitleText } from './space-title-text';
import { useSpaceMemberCount } from './use-space-member-count';

export type MiniplayerSpaceSummaryProps = {
  spaceId: string;
};

/**
 * One live space at a glance inside the miniplayer and its sheet: the
 * space's own mark, its title, then who hosts it and how many people are
 * there.
 */
export function MiniplayerSpaceSummary(
  props: MiniplayerSpaceSummaryProps
): JSX.Element {
  const count = useSpaceMemberCount(props.spaceId);
  return (
    <StackHorizontal grow align="center" gap="md">
      <SpaceMark spaceId={props.spaceId} />
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
