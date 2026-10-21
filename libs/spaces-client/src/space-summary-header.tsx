import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';
import { SpaceHostAvatar } from './space-host-avatar';
import { SpaceHostNameText } from './space-host-name-text';
import { SpaceLiveBadge } from './space-live-badge';
import { SpaceTitleText } from './space-title-text';

export type SpaceSummaryHeaderProps = {
  spaceId: string;
  hostAvatarSize?: number;
};

const DEFAULT_HOST_AVATAR_SIZE = 44;

export function SpaceSummaryHeader(
  props: SpaceSummaryHeaderProps
): JSX.Element {
  return (
    <StackHorizontal justify="between" gap="sm">
      <StackHorizontal grow align="center" gap="sm">
        <SpaceHostAvatar
          spaceId={props.spaceId}
          size={props.hostAvatarSize ?? DEFAULT_HOST_AVATAR_SIZE}
          vividBackdrop
        />
        <StackVertical grow>
          <SpaceTitleText
            spaceId={props.spaceId}
            variant="bodyBold"
            lines={1}
          />
          <SpaceHostNameText
            spaceId={props.spaceId}
            variant="caption"
            numberOfLines={1}
          />
        </StackVertical>
      </StackHorizontal>
      <SpaceLiveBadge spaceId={props.spaceId} />
    </StackHorizontal>
  );
}
